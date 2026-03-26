/*
 * ==========================================================================================
 * BLOCK MESH FACTORY ARCHITECTURE NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * Creates 3D Babylon.js meshes for Minecraft blocks. Uses a data-driven shape system
 * where block shapes are defined in mccat.json (uses `sh` property), not hardcoded.
 *
 * KEY PRINCIPLE: DATA-DRIVEN SHAPES
 * ----------------------------------
 * Block rendering is controlled by the `sh` property in public/data/mccat.json.
 * Each value maps to a BlockShape enum value, which routes to a specific mesh creator.
 *
 * SHAPE ENUM (src/minecraft/IBlockBaseTypeData.ts):
 * -------------------------------------------------
 * 0 = custom (fallback)    1 = unitCube           2 = stairs
 * 3 = slab                 4 = fence              5 = fenceGate
 * 6 = wall                 7 = door               8 = trapdoor
 * 9 = button              10 = pressurePlate      11 = torch
 * 12 = lantern            13 = chain              14 = ladder
 * 15 = rail               16 = lever              17 = anvil
 * 18 = candle             19 = endRod             20 = glassPaneOrBars
 * 21 = billboard          22 = carpet             23 = crop
 * 24 = leaves             25 = log                26 = water
 * 27 = redstoneWire       28 = sign               29 = hangingSign
 *
 * HOW createMesh() WORKS:
 * -----------------------
 * Block → BlockType → BlockBaseType → shape property → switch → specific mesh renderer
 *
 * ADDING A NEW BLOCK SHAPE:
 * -------------------------
 * 1. Add to BlockShape enum in src/minecraft/IBlockBaseTypeData.ts
 * 2. Add createXxxMesh() method in this file
 * 3. Add case to switch in createMesh()
 * 4. Update mccat.json with shape values for relevant blocks
 * 5. Add visual test in BlockViewer.spec.ts
 *
 * TEXTURE LOADING:
 * ----------------
 * Textures come from:
 * - terrain_texture.json: Maps texture names to file paths
 * - blocks.json: Maps block types to texture names per face (up, down, side)
 * - ProjectDefinitionUtilities.getVanillaBlockTexture(): Resolves textures
 *
 * CRITICAL: BlockViewer must call Database.loadVanillaResourceDefinitions() before
 * rendering, or all blocks will be magenta (missing texture fallback).
 *
 * ==========================================================================================
 * FACE PLANE RENDERING
 * ==========================================================================================
 *
 * When a block has some faces hidden by opaque neighbors, we optimize by creating
 * individual plane meshes instead of a full cube.
 *
 * CURRENT APPROACH: DOUBLESIDE
 * -----------------------------
 * All planes use DOUBLESIDE rendering so faces are visible from both directions.
 * This is necessary because:
 * - Exterior faces need to be visible from outside the structure
 * - Interior faces (inside hollow buildings) need to be visible from inside
 * - Single-sided rendering cannot satisfy both requirements with static orientation
 *
 * POTENTIAL Z-FIGHTING:
 * When zoomed in, there may be z-fighting artifacts where overlapping faces
 * flicker. If this becomes problematic, consider:
 * - Using zOffset on materials to push planes slightly back in depth buffer
 * - Using a depth pre-pass
 * - Implementing smarter face culling based on camera position
 *
 * BABYLONJS CREATEPLANE DEFAULTS:
 * - Creates plane in X-Y plane at z=0
 * - Front face normal points in -Z direction (0, 0, -1)
 *
 * FACE POSITIONS AND ROTATIONS:
 * | Face     | Position | Rotation     | Notes                              |
 * |----------|----------|--------------|------------------------------------|
 * | backward | z=-0.5   | Y=π          | Rotated to face -Z                 |
 * | forward  | z=+0.5   | none         | Default orientation, faces -Z      |
 * | left     | x=+0.5   | Y=-π/2       | Rotated to face +X                 |
 * | right    | x=-0.5   | Y=+π/2       | Rotated to face -X                 |
 * | up       | y=+0.5   | X=+π/2       | Rotated to face +Y                 |
 * | down     | y=-0.5   | X=3π/2       | Rotated to face -Y                 |
 *
 * ==========================================================================================
 *
 * COMMON ISSUES:
 * --------------
 * - Magenta/pink blocks: Missing texture - ensure loadVanillaResourceDefinitions() called
 * - Wrong texture: Check BlockType.catalogResource getter and texture lookup
 * - Block renders as cube: Missing shape in mccat.json - add "sh": N to block entry
 *
 * TESTING:
 * --------
 * npx playwright test BlockViewer.spec.ts --project=chromium
 * npx playwright test BlockViewer.spec.ts --project=chromium --update-snapshots
 *
 * Snapshots stored in debugoutput/res/snapshots/ (platform-agnostic, no OS suffix)
 *
 * ==========================================================================================
 */

import Block from "../../minecraft/Block";
import * as BABYLON from "babylonjs";
import IBlockVolumeBounds from "../../minecraft/IBlockVolumeBounds";
import Log from "../../core/Log";
import CreatorToolsHost from "../../app/CreatorToolsHost";
import BlockType from "../../minecraft/BlockType";
import Database from "../../minecraft/Database";
import { ProjectDefinitionUtilities } from "../../core/ProjectDefinitionUtilities";
import BoxMaterialAndUv, { BoxSide, BoxMaterialStrategy } from "./BoxMaterialAndUv";
import { BlockShape } from "../../minecraft/IBlockBaseTypeData";

export default class BlockMeshFactory {
  _materials: Map<string, BABYLON.StandardMaterial> = new Map();
  _boxMaterialsAnUv: Map<string, BoxMaterialAndUv> = new Map();
  _boundingMesh: BABYLON.Mesh | undefined;
  _scene: BABYLON.Scene;
  _bounds: IBlockVolumeBounds;

  /**
   * When true, uses standard textures (with alpha holes for leaves/vines) instead
   * of carried_textures. Set to true for in-world rendering (ChunkMeshBuilder).
   * Carried textures are pre-tinted for inventory display and lack alpha cutout.
   */
  useWorldTextures: boolean = false;

  constructor(scene: BABYLON.Scene, bounds?: IBlockVolumeBounds) {
    this._scene = scene;
    this._bounds = bounds ?? { fromX: 0, fromY: -64, fromZ: 0, toX: 16, toY: 320, toZ: 16 };
  }

  public getAppearanceHash(block: Block): string {
    if (block.shortTypeId === undefined) {
      Log.unexpectedUndefined("GAH");
      return "";
    }

    const waterLevel = block.effectiveWaterLevel;
    let base = block.shortTypeId + String.fromCharCode(48 + waterLevel) + "." + block.data + ".";

    if (block.blockType !== undefined && block.x !== undefined && block.y !== undefined && block.z !== undefined) {
      const shortTypeName = block.shortTypeId;
      const surround = block.surroundings;

      if (surround !== undefined) {
        let waterCode = 0;

        //   if (blockBaseType.isCovering) {
        let blockOpacityCode = 0;

        if (
          surround.up === undefined ||
          surround.up.isEmpty ||
          (!surround.up.isOpaque &&
            surround.up.shortTypeId !== shortTypeName &&
            (waterLevel < 16 || surround.up.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode++;
        }

        let nextWaterLevel = surround.up?.effectiveWaterLevel ?? 0;
        if (nextWaterLevel >= 16) {
          waterCode++;
        }

        if (
          surround.down === undefined ||
          surround.down.isEmpty ||
          (!surround.down.isOpaque &&
            surround.down.shortTypeId !== shortTypeName &&
            (waterLevel < 16 || surround.down.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 2;
        }

        nextWaterLevel = surround.down?.effectiveWaterLevel ?? 0;
        if (nextWaterLevel >= 16) {
          waterCode += 2;
        }

        if (
          surround.left === undefined ||
          surround.left.isEmpty ||
          (!surround.left.isOpaque &&
            surround.left.shortTypeId !== shortTypeName &&
            (waterLevel < 16 || surround.left.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 4;
        }

        nextWaterLevel = surround.left?.effectiveWaterLevel ?? 0;
        if (nextWaterLevel >= 16) {
          waterCode += 4;
        }

        if (
          surround.right === undefined ||
          surround.right.isEmpty ||
          (!surround.right.isOpaque &&
            surround.right.shortTypeId !== shortTypeName &&
            (waterLevel < 16 || surround.right.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 8;
        }

        nextWaterLevel = surround.right?.effectiveWaterLevel ?? 0;
        if (nextWaterLevel >= 16) {
          waterCode += 8;
        }

        if (
          surround.forward === undefined ||
          surround.forward.isEmpty ||
          (!surround.forward.isOpaque &&
            surround.forward.shortTypeId !== shortTypeName &&
            (waterLevel < 16 || surround.forward.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 16;
        }

        nextWaterLevel = surround.forward?.effectiveWaterLevel ?? 0;
        if (nextWaterLevel >= 16) {
          waterCode += 16;
        }

        if (
          surround.backward === undefined ||
          surround.backward.isEmpty ||
          (!surround.backward.isOpaque &&
            surround.backward.shortTypeId !== shortTypeName &&
            (waterLevel < 16 || surround.backward.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 32;
        }

        nextWaterLevel = surround.backward?.effectiveWaterLevel ?? 0;
        if (nextWaterLevel >= 16) {
          waterCode += 32;
        }

        // if we're fully surrounded by opaque blocks (no faces exposed), return empty to indicate nothing should be rendered.
        // blockOpacityCode = 0 means no faces are exposed, blockOpacityCode = 63 means all faces are exposed
        if (blockOpacityCode === 0) {
          return "";
        }

        base += String.fromCharCode(48 + blockOpacityCode);

        base += String.fromCharCode(48 + waterCode);
      }
    }

    return base;
  }

  _ensureBoxMaterialAndUvFromPath(path: string): BoxMaterialAndUv {
    let bmau = this._boxMaterialsAnUv.get("_" + path);

    if (!bmau) {
      const material = this._ensureMaterialFromPath(path);
      bmau = new BoxMaterialAndUv(material);
      this._boxMaterialsAnUv.set("_" + path, bmau);
    }

    return bmau;
  }

  _ensureBoxMaterialAndUvFromBlockType(blockType: BlockType): BoxMaterialAndUv {
    const blockId = blockType.shortId;
    let bmau = this._boxMaterialsAnUv.get("bt_" + blockId);

    if (bmau) {
      return bmau;
    }

    // Get textures for each side from blocks.json via ProjectDefinitionUtilities
    // When useWorldTextures=true, skip carried_textures (which lack alpha cutout for leaves)
    const useCarried = !this.useWorldTextures;
    let upTex = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "up", useCarried);
    let downTex = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "down", useCarried);
    let sideTex = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side", useCarried);

    // NOTE: grass_side already has the correct dirt-with-grass-strip appearance.

    // Check if we have different textures for different sides
    const hasDistinctSides = upTex !== sideTex || downTex !== sideTex || upTex !== downTex;

    if (hasDistinctSides && sideTex && upTex && downTex) {
      // Create materials for each distinct texture
      const sideMaterial = this._ensureMaterialFromPath(sideTex);
      const topMaterial = this._ensureMaterialFromPath(upTex);
      const bottomMaterial = this._ensureMaterialFromPath(downTex);

      bmau = new BoxMaterialAndUv();
      bmau.setSideTopBottom(sideMaterial, topMaterial, bottomMaterial);
    } else {
      // Use uniform material
      const tex = upTex || sideTex || downTex;
      if (tex) {
        const material = this._ensureMaterialFromPath(tex);
        bmau = new BoxMaterialAndUv(material);
      } else {
        // Fallback to old method
        const material = this._ensureBoxMaterial(blockType);
        bmau = new BoxMaterialAndUv(material);
      }
    }

    this._boxMaterialsAnUv.set("bt_" + blockId, bmau);
    return bmau;
  }

  _ensureBoxMaterialAndUv(id: string, material: BABYLON.StandardMaterial): BoxMaterialAndUv {
    let bmau = this._boxMaterialsAnUv.get(id);

    if (!bmau) {
      bmau = new BoxMaterialAndUv(material);
      this._boxMaterialsAnUv.set(id, bmau);
    }

    return bmau;
  }

  createWaterMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    let level = 1 - block.effectiveWaterLevel / Block.MAX_WATER_LEVEL;

    if (level <= 0) {
      level = 0.02;
    } else if (level >= 1) {
      level = 0.98;
    }

    let bmau = this._boxMaterialsAnUv.get("_water");

    if (!bmau) {
      const waterMaterial = new BABYLON.StandardMaterial("water", this._scene);
      waterMaterial.alpha = 0.6;
      waterMaterial.diffuseColor = new BABYLON.Color3(0.02, 0.02, 1);
      waterMaterial.zOffset = -2; // Prevent z-fighting with coplanar surfaces
      bmau = new BoxMaterialAndUv(waterMaterial);
      this._boxMaterialsAnUv.set("_water", bmau);
    }

    const sourceMesh = this._createBlockMesh(name, block, bmau, 1, level, 1);

    return sourceMesh;
  }

  createStairsMesh(name: string, block: Block): BABYLON.Mesh {
    const sourceMesh = new BABYLON.Mesh(name, this._scene); //this.createBoundingMesh(name);
    this._applyMeshSettings(sourceMesh);

    const sourceMeshLower = BABYLON.MeshBuilder.CreateBox(name + "|u", this._createBoxOptions(1, 0.5, 1));
    sourceMeshLower.position.y = 0 - 0.25;
    sourceMesh.addChild(sourceMeshLower);

    const sourceMeshUpper = BABYLON.MeshBuilder.CreateBox(name + "|l", this._createBoxOptions(0.5, 0.5, 1));
    sourceMeshUpper.position.y = 0.25;
    sourceMeshUpper.position.x = -0.25;
    sourceMesh.addChild(sourceMeshUpper);

    const blockType = block.blockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const stairMaterial = this._ensureBoxMaterial(blockType);

    sourceMeshLower.material = stairMaterial;
    sourceMeshUpper.material = stairMaterial;

    const dir = block.getPropertyNumber("weirdo_direction", 0);

    // Rotate based on facing direction: 0=east, 1=west, 2=south, 3=north
    if (dir === 0) {
      sourceMesh.rotation.y = Math.PI / 2; // East
    } else if (dir === 1) {
      sourceMesh.rotation.y = -Math.PI / 2; // West
    } else if (dir === 2) {
      sourceMesh.rotation.y = Math.PI; // South
    } else if (dir === 3) {
      sourceMesh.rotation.y = 0; // North
    }

    return sourceMesh;
  }

  createButtonMesh(name: string, block: Block): BABYLON.Mesh {
    const sourceMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(sourceMesh);

    const buttonMesh = BABYLON.MeshBuilder.CreateBox(name + "|u", this._createBoxOptions(0.2, 0.1, 0.2));
    buttonMesh.position.y = 0 - 0.45;
    sourceMesh.addChild(buttonMesh);

    const blockType = block.blockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const buttonMaterial = this._ensureBoxMaterial(blockType);

    buttonMesh.material = buttonMaterial;

    return sourceMesh;
  }

  createDoorMesh(name: string, block: Block): BABYLON.Mesh {
    const blockType = block.blockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const isUpper = block.getPropertyBoolean("upper_block_bit", false);

    const sourceMesh = BABYLON.MeshBuilder.CreateBox(name, this._createBoxOptions(1, 1, 0.13), this._scene);

    // Use the proper texture lookup - doors have different textures for up (upper) and down (lower)
    const side = isUpper ? "up" : "down";
    let texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, side);

    if (!texPath) {
      // Fallback to side texture
      texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side");
    }

    if (texPath) {
      const doorMaterial = this._ensureMaterialFromPath(texPath);
      sourceMesh.material = doorMaterial;
    }

    return sourceMesh;
  }

  createLogMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    const blockType = block.blockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    // Use the proper texture lookup from blocks.json/terrain_texture.json
    const bmau = this._ensureBoxMaterialAndUvFromBlockType(blockType);

    const sourceMesh = this._createBlockMesh(name, block, bmau, 1, 1, 1);

    return sourceMesh;
  }

  createLeavesMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    const blockType = block.blockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    // Use the proper texture lookup from blocks.json/terrain_texture.json
    // blocks.json uses carried_textures for leaves which is preferred by ProjectDefinitionUtilities
    const bmau = this._ensureBoxMaterialAndUvFromBlockType(blockType);

    const sourceMesh = this._createBlockMesh(name, block, bmau, 1, 1, 1);

    return sourceMesh;
  }

  createTallGrassMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const sourceMesh = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);

    const blockType = block.blockType;

    if (blockType !== undefined) {
      // Use the proper texture lookup from blocks.json/terrain_texture.json
      let texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "up");

      if (!texPath) {
        texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side");
      }

      if (texPath) {
        const material = this._ensureMaterialFromPath(texPath);
        sourceMesh.material = material;
      }
    }

    return sourceMesh;
  }

  createFlowerMesh(name: string, block: Block): BABYLON.Mesh {
    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const sourceMesh = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);
    sourceMesh.rotation.y = Math.PI / 4; // 45 degrees

    const sourceMeshB = BABYLON.MeshBuilder.CreatePlane(name + "_b", options, this._scene);
    sourceMeshB.rotation.y = -(Math.PI / 4); // -45 degrees

    sourceMesh.addChild(sourceMeshB);

    const blockType = block.blockType;

    if (blockType !== undefined) {
      // Use the proper texture lookup from blocks.json/terrain_texture.json
      let texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "up");

      if (!texPath) {
        texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side");
      }

      if (texPath) {
        const material = this._ensureMaterialFromPath(texPath);
        sourceMesh.material = material;
        sourceMeshB.material = material;
      }
    }

    return sourceMesh;
  }

  createBillboardMesh(name: string, block: Block): BABYLON.Mesh {
    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    // Create wrapper mesh to hold two perpendicular planes forming an X cross.
    // Standard Minecraft cross: planes at ±45° (forming an X from top view).
    const wrapper = new BABYLON.Mesh(name, this._scene);

    const planeA = BABYLON.MeshBuilder.CreatePlane(name + "_a", options, this._scene);
    planeA.rotation.y = Math.PI / 4; // 45 degrees

    const planeB = BABYLON.MeshBuilder.CreatePlane(name + "_b", options, this._scene);
    planeB.rotation.y = -(Math.PI / 4); // -45 degrees

    wrapper.addChild(planeA);
    wrapper.addChild(planeB);

    const blockType = block.blockType;

    if (blockType !== undefined) {
      let texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "up");

      if (!texPath) {
        texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side");
      }

      if (texPath) {
        const material = this._ensureMaterialFromPath(texPath);
        planeA.material = material;
        planeB.material = material;
      }
    }

    return wrapper;
  }

  createRedstoneWireMesh(name: string, block: Block): BABYLON.Mesh {
    const sourceMesh = new BABYLON.Mesh(name, this._scene); //this.createBoundingMesh(name);
    this._applyMeshSettings(sourceMesh);

    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.FRONTSIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const wireMesh = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);
    wireMesh.rotation.x = Math.PI / 2;
    wireMesh.position.y = 0 - 0.5;

    sourceMesh.addChild(wireMesh);

    // Use proper texture lookup from blocks.json/terrain_texture.json
    const blockType = block.blockType;
    if (blockType !== undefined) {
      // Redstone wire typically uses the "up" texture (redstone_dust_cross) for the flat display
      let texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "up");

      if (!texPath) {
        texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side");
      }

      if (texPath) {
        const material = this._ensureMaterialFromPath(texPath);
        wireMesh.material = material;
      }
    }

    return sourceMesh;
  }

  createRailMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    if (block.shortTypeId === undefined) {
      return undefined;
    }
    const sourceMesh = new BABYLON.Mesh(name, this._scene); //this.createBoundingMesh(name);
    this._applyMeshSettings(sourceMesh);

    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.FRONTSIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const wireMesh = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);
    wireMesh.rotation.x = Math.PI / 2;
    wireMesh.position.y = 0 - 0.5;

    sourceMesh.addChild(wireMesh);

    let materialName = block.shortTypeId;

    const blockType = block.blockType;

    if (!blockType) {
      throw new Error("Undefined block type for rail mesh");
    }

    const material = this._ensureBoxMaterial(blockType);

    wireMesh.material = material;

    return sourceMesh;
  }

  createGrassPathMesh(name: string, block: Block): BABYLON.Mesh {
    const faceUV = new Array(6);

    faceUV[0] = new BABYLON.Vector4(0, 0.1, 0.5, 1);
    faceUV[1] = new BABYLON.Vector4(0, 0.1, 0.5, 1);
    faceUV[2] = new BABYLON.Vector4(0, 0.1, 0.5, 1);
    faceUV[3] = new BABYLON.Vector4(0, 0.1, 0.5, 1);
    faceUV[4] = new BABYLON.Vector4(0.5, 0, 1, 1);
    faceUV[5] = new BABYLON.Vector4(0.5, 0, 1, 1);

    const options = {
      width: 1,
      height: 0.9,
      depth: 1,
      updatable: false,
      faceUV: faceUV,
    };

    const sourceMesh = BABYLON.MeshBuilder.CreateBox(name, options, this._scene);

    const logMaterial = this._ensureMaterialFromPath("grass_path_f");

    sourceMesh.material = logMaterial;

    return sourceMesh;
  }

  /**
   * Apply semi-transparent rendering to barrier block meshes.
   * The barrier texture has a red circle-slash on a transparent background.
   * Uses alpha-test so the red symbol is fully visible but the background is
   * see-through, matching how barriers appear in Minecraft creative mode.
   */
  _applyBarrierTransparency(mesh: BABYLON.Mesh) {
    this._applyAlphaTest(mesh, 0.1);
  }

  /**
   * Apply alpha-test transparency to a mesh and all its children.
   * Transparent pixels below the cutoff threshold become fully see-through,
   * while opaque pixels render normally. Used for blocks with transparent
   * textures: flowers, leaves, ladders, glass panes, crops, etc.
   */
  _applyAlphaTest(mesh: BABYLON.Mesh, alphaCutOff: number = 0.3) {
    const applyToMat = (mat: BABYLON.Material | null) => {
      if (mat instanceof BABYLON.StandardMaterial) {
        mat.unfreeze();
        if (mat.diffuseTexture) {
          (mat.diffuseTexture as BABYLON.Texture).hasAlpha = true;
        }
        mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
        mat.alphaCutOff = alphaCutOff;
        mat.useAlphaFromDiffuseTexture = true;
        mat.backFaceCulling = false;
        mat.freeze();
      }
    };

    applyToMat(mesh.material);
    for (const child of mesh.getChildMeshes()) {
      applyToMat(child.material);
    }
  }

  _applyWaterLogging(block: Block, mesh: BABYLON.Mesh) {
    if (block.effectiveWaterLevel > 0) {
      mesh.isOccluded = true;
      mesh.scaling.x = 0.99;
      mesh.scaling.y = 0.99;
      mesh.scaling.z = 0.99;

      const waterMesh = this.createWaterMesh("wl", block);

      if (waterMesh) {
        mesh.addChild(waterMesh);
      }
    }
  }

  createMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    let sourceMesh: BABYLON.Mesh | undefined;

    if (this._scene === undefined || this._scene === null || block.blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const shortId = block.shortTypeId || "";

    // Skip truly invisible blocks — structure_void and light_block have no visual
    // representation. Barrier blocks are rendered semi-transparent (see below).
    if (shortId === "structure_void" || shortId === "light_block") {
      return undefined;
    }

    const shape = block.blockType.baseType.shape;

    // Use data-driven shape from mccat.json
    switch (shape) {
      case BlockShape.water:
        sourceMesh = this.createWaterMesh(name, block);
        break;

      case BlockShape.stairs:
        sourceMesh = this.createStairsMesh(name, block);
        this._applyWaterLogging(block, sourceMesh);
        break;

      case BlockShape.button:
        sourceMesh = this.createButtonMesh(name, block);
        this._applyWaterLogging(block, sourceMesh);
        break;

      case BlockShape.leaves:
        sourceMesh = this.createLeavesMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyAlphaTest(sourceMesh);
        }
        break;

      case BlockShape.door:
        sourceMesh = this.createDoorMesh(name, block);
        this._applyWaterLogging(block, sourceMesh);
        break;

      case BlockShape.log:
        sourceMesh = this.createLogMesh(name, block);
        break;

      case BlockShape.redstoneWire:
        sourceMesh = this.createRedstoneWireMesh(name, block);
        break;

      case BlockShape.rail:
        sourceMesh = this.createRailMesh(name, block);
        break;

      case BlockShape.carpet:
        sourceMesh = this.createCarpetMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.slab:
        // Check if it's a double slab (full block)
        if (shortId.includes("double")) {
          sourceMesh = this.createDoubleSlab(name, block);
        } else {
          const isTop =
            block.properties["minecraft:vertical_half"]?.value === "top" ||
            block.properties["top_slot_bit"]?.value === true;
          sourceMesh = this.createSlabMesh(name, block, isTop);
          if (sourceMesh !== undefined) {
            this._applyWaterLogging(block, sourceMesh);
          }
        }
        break;

      case BlockShape.fence:
        // Bamboo fences have a special frame texture and need 4-corner geometry
        if (shortId.includes("bamboo")) {
          sourceMesh = this.createBambooFenceMesh(name, block);
        } else {
          sourceMesh = this.createFenceMesh(name, block);
        }
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.fenceGate:
        // Bamboo fence gates also have special geometry
        if (shortId.includes("bamboo")) {
          sourceMesh = this.createBambooFenceGateMesh(name, block);
        } else {
          sourceMesh = this.createFenceMesh(name, block);
        }
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.wall:
        sourceMesh = this.createWallMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.trapdoor:
        const isOpen = block.properties["open_bit"]?.value === true;
        sourceMesh = this.createTrapdoorMesh(name, block, isOpen);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.glassPaneOrBars:
        sourceMesh = this.createGlassPaneMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyAlphaTest(sourceMesh);
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.torch:
        sourceMesh = this.createTorchMesh(name, block);
        break;

      case BlockShape.pressurePlate:
        sourceMesh = this.createPressurePlateMesh(name, block);
        break;

      case BlockShape.ladder:
        sourceMesh = this.createLadderMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyAlphaTest(sourceMesh);
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.chain:
        sourceMesh = this.createChainMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.lantern:
        sourceMesh = this.createLanternMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.anvil:
        sourceMesh = this.createAnvilMesh(name, block);
        break;

      case BlockShape.candle:
        sourceMesh = this.createCandleMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.lever:
        sourceMesh = this.createLeverMesh(name, block);
        break;

      case BlockShape.endRod:
        sourceMesh = this.createEndRodMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.crop:
        sourceMesh = this.createCropMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyAlphaTest(sourceMesh);
        }
        break;

      case BlockShape.sign:
        sourceMesh = this.createBillboardMesh(name, block);
        break;

      case BlockShape.hangingSign:
        sourceMesh = this.createBillboardMesh(name, block);
        break;

      case BlockShape.billboard:
        // Cross/X shape for saplings, flowers, mushrooms, dead bush, fern, etc.
        sourceMesh = this.createBillboardMesh(name, block);
        this._applyAlphaTest(sourceMesh);
        this._applyWaterLogging(block, sourceMesh);
        break;

      case BlockShape.unitCube:
        sourceMesh = this.createUnitCubeMesh(name, block);
        if (sourceMesh !== undefined && !block.isOpaque) {
          this._applyAlphaTest(sourceMesh);
        }
        break;

      case BlockShape.bed:
        sourceMesh = this.createBedMesh(name, block);
        break;

      case BlockShape.chest:
        sourceMesh = this.createChestMesh(name, block);
        break;

      case BlockShape.campfire:
        sourceMesh = this.createCampfireMesh(name, block);
        break;

      case BlockShape.bell:
        sourceMesh = this.createBellMesh(name, block);
        break;

      case BlockShape.hopper:
        sourceMesh = this.createHopperMesh(name, block);
        break;

      case BlockShape.brewingStand:
        sourceMesh = this.createBrewingStandMesh(name, block);
        break;

      case BlockShape.enchantingTable:
        sourceMesh = this.createEnchantingTableMesh(name, block);
        break;

      case BlockShape.cauldron:
        sourceMesh = this.createCauldronMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.dripleaf:
        sourceMesh = this.createDripleafMesh(name, block);
        if (sourceMesh !== undefined) {
          this._applyWaterLogging(block, sourceMesh);
        }
        break;

      case BlockShape.custom:
      default:
        // Fallback: try pattern matching for blocks not yet in mccat.json
        sourceMesh = this._createMeshByPattern(name, block, shortId);
        break;
    }

    // Barrier blocks: render with alpha-test transparency so the red circle-slash
    // is visible but the background is see-through (matching Minecraft creative mode).
    if (shortId === "barrier" && sourceMesh) {
      this._applyBarrierTransparency(sourceMesh);
    }

    return sourceMesh;
  }

  /**
   * Fallback pattern matching for blocks not yet assigned a shape in mccat.json.
   * This method preserves the original pattern-matching logic.
   */
  _createMeshByPattern(name: string, block: Block, shortId: string): BABYLON.Mesh | undefined {
    let sourceMesh: BABYLON.Mesh | undefined;
    const baseType = block.blockType?.baseType.name || "";

    // Pattern-matching fallbacks for blocks without shape data
    if (baseType === "grass_path" || shortId === "grass_path" || shortId === "dirt_path") {
      sourceMesh = this.createGrassPathMesh(name, block);
    } else if (baseType === "tallgrass" || shortId === "tallgrass" || shortId === "tall_grass") {
      sourceMesh = this.createTallGrassMesh(name, block);
    } else if (baseType === "flower" || this._isFlower(shortId)) {
      sourceMesh = this.createFlowerMesh(name, block);
      this._applyWaterLogging(block, sourceMesh);
    } else if (baseType === "wood" || shortId.endsWith("_wood")) {
      sourceMesh = this.createWoodMesh(name, block);
      if (sourceMesh !== undefined) {
        this._applyWaterLogging(block, sourceMesh);
      }
    } else if (baseType === "planks" || shortId.endsWith("_planks")) {
      sourceMesh = this.createPlankMesh(name, block);
      if (sourceMesh !== undefined) {
        this._applyWaterLogging(block, sourceMesh);
      }
    } else {
      // Default to unit cube
      sourceMesh = this.createUnitCubeMesh(name, block);
    }

    return sourceMesh;
  }

  _isFlower(shortId: string): boolean {
    const flowers = [
      "dandelion",
      "poppy",
      "blue_orchid",
      "allium",
      "azure_bluet",
      "red_tulip",
      "orange_tulip",
      "white_tulip",
      "pink_tulip",
      "oxeye_daisy",
      "cornflower",
      "lily_of_the_valley",
      "wither_rose",
      "sunflower",
      "lilac",
      "rose_bush",
      "peony",
      "torchflower",
      "pitcher_plant",
      "pink_petals",
    ];
    return flowers.includes(shortId) || shortId.includes("flower");
  }

  createErrorMesh(name: string) {
    const sourceMesh = BABYLON.MeshBuilder.CreateBox(name, this._createBoxOptions(1, 1, 1), this._scene);

    sourceMesh.material = this._ensureMaterialFromPath("barrier");

    return sourceMesh;
  }

  createWoodMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined) {
      return undefined;
    }

    let materialName = block.shortTypeId;

    const blockType = block.blockType;

    if (materialName === "wood") {
      const woodMaterialProperties = block.properties["wood_type"];

      if (woodMaterialProperties !== undefined) {
        materialName = "log_" + woodMaterialProperties.value;
      }
    }

    let material = undefined;

    if (blockType) {
      material = this._ensureBoxMaterial(blockType);
    } else {
      material = this._ensureMaterialFromPath(materialName);
    }

    return this._createBlockMesh(name, block, new BoxMaterialAndUv(material), 1, 1, 1);
  }

  createPlankMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined) {
      return undefined;
    }

    let materialName = block.shortTypeId;

    const blockType = block.blockType;

    if (materialName === "planks") {
      const woodMaterialProperties = block.properties["wood_type"];

      if (woodMaterialProperties !== undefined) {
        materialName += "_" + woodMaterialProperties.value;
      }
    } else {
      if (blockType !== undefined) {
        materialName = blockType.getIcon();
      }
    }
    let material = undefined;

    if (blockType) {
      material = this._ensureBoxMaterial(blockType);
    } else {
      material = this._ensureMaterialFromPath(materialName);
    }
    return this._createBlockMesh(name, block, new BoxMaterialAndUv(material), 1, 1, 1);
  }

  createCarpetMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    return this._createBlockMesh(
      name,
      block,
      new BoxMaterialAndUv(this._ensureBoxMaterial(block.blockType)),
      1,
      0.2,
      1
    );
  }

  createSlabMesh(name: string, block: Block, isTop: boolean = false) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const boxMaterialAndUv = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);

    // Slabs are half-height blocks. isTop determines if slab is on top or bottom half
    const mesh = this._createBlockMesh(name, block, boxMaterialAndUv, 1, 0.5, 1);

    if (mesh) {
      // Adjust vertical position based on whether it's a top or bottom slab
      const topBottomOffset = isTop ? 0.25 : -0.25;
      mesh.position.y = topBottomOffset;
    }

    return mesh;
  }

  createDoubleSlab(name: string, block: Block) {
    // Double slabs are just regular full blocks
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const boxMaterialAndUv = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);
    return this._createBlockMesh(name, block, boxMaterialAndUv, 1, 1, 1);
  }

  createFenceMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);
    const defaultMatUv = bmau.getDefaultMaterialAndUv();
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Center post (0.25 x 1.5 x 0.25, but scaled to 0.25 since we use unit coords)
    const postWidth = 0.25;
    const postHeight = 1;

    // Create faceUV array with proper UV mapping for all 6 faces
    const faceUV = [
      defaultMatUv.uv, // front
      defaultMatUv.uv, // back
      defaultMatUv.uv, // right
      defaultMatUv.uv, // left
      defaultMatUv.uv, // top
      defaultMatUv.uv, // bottom
    ];

    const postMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|post",
      { width: postWidth, height: postHeight, depth: postWidth, faceUV: faceUV },
      this._scene
    );
    postMesh.material = defaultMatUv.material;
    this._applyMeshSettings(postMesh);
    parentMesh.addChild(postMesh);

    // TODO: Add horizontal bars based on connections
    // In a full implementation, you'd check block.surroundings for fence connections
    // Bar dimensions: barHeight = 0.0625 * 3 (3 pixels), barWidth = 0.125 (2 pixels wide)

    return parentMesh;
  }

  /**
   * Creates a bamboo-style fence mesh with 4 thin corner posts.
   * Bamboo fences have a unique frame-style texture that's designed for
   * 4 thin vertical posts at the corners, not a single thick center post.
   */
  createBambooFenceMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);
    const defaultMatUv = bmau.getDefaultMaterialAndUv();
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Bamboo fence has 4 thin corner posts - each about 3 pixels wide (3/16 = 0.1875)
    const postWidth = 0.125; // 2 pixels wide
    const postHeight = 1;
    const frameOffset = 0.0625; // 1/16 - offset from center to place corner posts

    // Create faceUV array
    const faceUV = [
      defaultMatUv.uv,
      defaultMatUv.uv,
      defaultMatUv.uv,
      defaultMatUv.uv,
      defaultMatUv.uv,
      defaultMatUv.uv,
    ];

    // Create 4 corner posts forming a square frame
    const corners = [
      { x: -frameOffset, z: -frameOffset },
      { x: frameOffset, z: -frameOffset },
      { x: -frameOffset, z: frameOffset },
      { x: frameOffset, z: frameOffset },
    ];

    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i];
      const postMesh = BABYLON.MeshBuilder.CreateBox(
        name + `|post${i}`,
        { width: postWidth, height: postHeight, depth: postWidth, faceUV: faceUV },
        this._scene
      );
      postMesh.position.x = corner.x;
      postMesh.position.z = corner.z;
      postMesh.material = defaultMatUv.material;
      this._applyMeshSettings(postMesh);
      parentMesh.addChild(postMesh);
    }

    return parentMesh;
  }

  /**
   * Creates a bamboo fence gate mesh.
   */
  createBambooFenceGateMesh(name: string, block: Block) {
    // Use same as bamboo fence for now
    return this.createBambooFenceMesh(name, block);
  }

  createWallMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);
    const defaultMatUv = bmau.getDefaultMaterialAndUv();
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Center post (0.5 x 1.0 x 0.5)
    const postWidth = 0.5;
    const postHeight = 1;

    // Create faceUV array with proper UV mapping for all 6 faces
    const faceUV = [
      defaultMatUv.uv, // front
      defaultMatUv.uv, // back
      defaultMatUv.uv, // right
      defaultMatUv.uv, // left
      defaultMatUv.uv, // top
      defaultMatUv.uv, // bottom
    ];

    const postMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|post",
      { width: postWidth, height: postHeight, depth: postWidth, faceUV: faceUV },
      this._scene
    );
    postMesh.material = defaultMatUv.material;
    this._applyMeshSettings(postMesh);
    parentMesh.addChild(postMesh);

    return parentMesh;
  }

  createTrapdoorMesh(name: string, block: Block, isOpen: boolean = false) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);
    const defaultMatUv = bmau.getDefaultMaterialAndUv();
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Trapdoor is a thin horizontal panel (1 x 0.1875 x 1) when closed
    const thickness = 0.1875; // 3 pixels

    // Create faceUV array with proper UV mapping for all 6 faces
    const faceUV = [
      defaultMatUv.uv, // front
      defaultMatUv.uv, // back
      defaultMatUv.uv, // right
      defaultMatUv.uv, // left
      defaultMatUv.uv, // top
      defaultMatUv.uv, // bottom
    ];

    if (isOpen) {
      // When open, trapdoor is vertical on one side
      const trapMesh = BABYLON.MeshBuilder.CreateBox(
        name + "|trap",
        { width: 1, height: 1, depth: thickness, faceUV: faceUV },
        this._scene
      );
      trapMesh.material = defaultMatUv.material;
      trapMesh.position.z = 0.5 - thickness / 2;
      this._applyMeshSettings(trapMesh);
      parentMesh.addChild(trapMesh);
    } else {
      // When closed, trapdoor is horizontal at bottom
      const trapMesh = BABYLON.MeshBuilder.CreateBox(
        name + "|trap",
        { width: 1, height: thickness, depth: 1, faceUV: faceUV },
        this._scene
      );
      trapMesh.material = defaultMatUv.material;
      trapMesh.position.y = -0.5 + thickness / 2;
      this._applyMeshSettings(trapMesh);
      parentMesh.addChild(trapMesh);
    }

    return parentMesh;
  }

  createGlassPaneMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(block.blockType);
    const defaultMatUv = bmau.getDefaultMaterialAndUv();
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Glass pane thickness: 2 pixels = 0.125 blocks
    const thickness = 0.125;

    // Create faceUV array with proper UV mapping for all 6 faces
    const faceUV = [
      defaultMatUv.uv, // front
      defaultMatUv.uv, // back
      defaultMatUv.uv, // right
      defaultMatUv.uv, // left
      defaultMatUv.uv, // top
      defaultMatUv.uv, // bottom
    ];
    const material = defaultMatUv.material;

    // Check surroundings to determine connections
    const surround = block.surroundings;
    const shortTypeName = block.shortTypeId;

    // Determine which directions have connections (to same block type or solid blocks)
    let hasNorth = false;
    let hasSouth = false;
    let hasEast = false;
    let hasWest = false;

    if (surround) {
      // Check for connections - glass panes connect to other glass panes, bars, or solid blocks
      hasNorth =
        surround.forward !== undefined &&
        !surround.forward.isEmpty &&
        (surround.forward.shortTypeId === shortTypeName ||
          surround.forward.isOpaque === true ||
          surround.forward.shortTypeId?.includes("pane") === true ||
          surround.forward.shortTypeId?.includes("bars") === true);
      hasSouth =
        surround.backward !== undefined &&
        !surround.backward.isEmpty &&
        (surround.backward.shortTypeId === shortTypeName ||
          surround.backward.isOpaque === true ||
          surround.backward.shortTypeId?.includes("pane") === true ||
          surround.backward.shortTypeId?.includes("bars") === true);
      hasEast =
        surround.right !== undefined &&
        !surround.right.isEmpty &&
        (surround.right.shortTypeId === shortTypeName ||
          surround.right.isOpaque === true ||
          surround.right.shortTypeId?.includes("pane") === true ||
          surround.right.shortTypeId?.includes("bars") === true);
      hasWest =
        surround.left !== undefined &&
        !surround.left.isEmpty &&
        (surround.left.shortTypeId === shortTypeName ||
          surround.left.isOpaque === true ||
          surround.left.shortTypeId?.includes("pane") === true ||
          surround.left.shortTypeId?.includes("bars") === true);
    }

    // For standalone panes (no connections), show a centered cross post
    // For connected panes, show the connection arms
    const hasAnyConnection = hasNorth || hasSouth || hasEast || hasWest;

    if (!hasAnyConnection) {
      // Standalone: show a simple thin post (vertical pane in north-south orientation)
      const postMesh = BABYLON.MeshBuilder.CreateBox(
        name + "|post",
        { width: thickness, height: 1, depth: thickness, faceUV: faceUV },
        this._scene
      );
      postMesh.material = material;
      this._applyMeshSettings(postMesh);
      parentMesh.addChild(postMesh);
    } else {
      // Create a center post
      const postMesh = BABYLON.MeshBuilder.CreateBox(
        name + "|post",
        { width: thickness, height: 1, depth: thickness, faceUV: faceUV },
        this._scene
      );
      postMesh.material = material;
      this._applyMeshSettings(postMesh);
      parentMesh.addChild(postMesh);

      // Add connection arms based on neighbors
      if (hasNorth || hasSouth) {
        const armLength = (hasNorth ? 0.5 : 0) + (hasSouth ? 0.5 : 0);
        const armZ = hasNorth && hasSouth ? 0 : hasNorth ? 0.25 : -0.25;
        const armMesh = BABYLON.MeshBuilder.CreateBox(
          name + "|ns",
          { width: thickness, height: 1, depth: armLength, faceUV: faceUV },
          this._scene
        );
        armMesh.material = material;
        armMesh.position.z = armZ;
        this._applyMeshSettings(armMesh);
        parentMesh.addChild(armMesh);
      }

      if (hasEast || hasWest) {
        const armLength = (hasEast ? 0.5 : 0) + (hasWest ? 0.5 : 0);
        const armX = hasEast && hasWest ? 0 : hasEast ? 0.25 : -0.25;
        const armMesh = BABYLON.MeshBuilder.CreateBox(
          name + "|ew",
          { width: armLength, height: 1, depth: thickness, faceUV: faceUV },
          this._scene
        );
        armMesh.material = material;
        armMesh.position.x = armX;
        this._applyMeshSettings(armMesh);
        parentMesh.addChild(armMesh);
      }
    }

    return parentMesh;
  }

  createTorchMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Torch is a 3D box: 2x10x2 pixels (0.125 x 0.625 x 0.125 in block units)
    const torchWidth = 0.125; // 2 pixels
    const torchHeight = 0.625; // 10 pixels

    const torchMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|stick",
      { width: torchWidth, height: torchHeight, depth: torchWidth },
      this._scene
    );
    torchMesh.material = material;
    // Position torch sitting on the bottom of the block space
    torchMesh.position.y = -0.5 + torchHeight / 2;
    this._applyMeshSettings(torchMesh);
    parentMesh.addChild(torchMesh);

    return parentMesh;
  }

  createPressurePlateMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);

    // Pressure plate is thin and slightly smaller than a full block
    const plateWidth = 0.875; // 14 pixels
    const plateHeight = 0.0625; // 1 pixel

    const mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width: plateWidth, height: plateHeight, depth: plateWidth },
      this._scene
    );
    mesh.material = material;
    mesh.position.y = -0.5 + plateHeight / 2;
    this._applyMeshSettings(mesh);

    return mesh;
  }

  createLadderMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);

    // Ladder is a thin flat panel on one side of a block
    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const mesh = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);
    mesh.material = material;
    mesh.position.z = 0.5 - 0.01; // Slightly inset from the block face
    mesh.rotation.y = Math.PI;
    this._applyMeshSettings(mesh);

    return mesh;
  }

  createChainMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Chain is a thin vertical 3D box: 3x16x3 pixels (0.1875 x 1.0 x 0.1875)
    const chainWidth = 0.1875; // 3 pixels
    const chainHeight = 1.0; // Full block height

    const chainMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|chain",
      { width: chainWidth, height: chainHeight, depth: chainWidth },
      this._scene
    );
    chainMesh.material = material;
    // Chain is centered vertically in the block
    this._applyMeshSettings(chainMesh);
    parentMesh.addChild(chainMesh);

    return parentMesh;
  }

  createLanternMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Lantern body (0.375 x 0.5625 x 0.375)
    const bodyWidth = 0.375; // 6 pixels
    const bodyHeight = 0.5625; // 9 pixels

    const bodyMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|body",
      { width: bodyWidth, height: bodyHeight, depth: bodyWidth },
      this._scene
    );
    bodyMesh.material = material;
    bodyMesh.position.y = -0.5 + bodyHeight / 2;
    this._applyMeshSettings(bodyMesh);
    parentMesh.addChild(bodyMesh);

    return parentMesh;
  }

  createAnvilMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    // Use iron block texture - the anvil.png texture is a sparse sprite with transparency
    const material = this._ensureMaterialFromPath("textures/blocks/iron_block");
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Anvil dimensions based on Minecraft model (in block units, 1 block = 16 pixels)
    // Base: 12x4x12 pixels = 0.75 x 0.25 x 0.75
    // Middle: 4x5x6 pixels = 0.25 x 0.3125 x 0.375
    // Top: 10x6x16 pixels = 0.625 x 0.375 x 1.0

    const baseWidth = 0.75;
    const baseHeight = 0.25;
    const baseDepth = 0.75;

    const middleWidth = 0.25;
    const middleHeight = 0.3125;
    const middleDepth = 0.375;

    const topWidth = 0.625;
    const topHeight = 0.375;
    const topDepth = 1.0;

    // Calculate Y positions so parts are stacked touching each other
    const baseY = -0.5 + baseHeight / 2;
    const middleY = -0.5 + baseHeight + middleHeight / 2;
    const topY = -0.5 + baseHeight + middleHeight + topHeight / 2;

    // Anvil base (wide at bottom)
    const baseMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|base",
      { width: baseWidth, height: baseHeight, depth: baseDepth },
      this._scene
    );
    baseMesh.material = material;
    baseMesh.position.y = baseY;
    this._applyMeshSettings(baseMesh);
    parentMesh.addChild(baseMesh);

    // Anvil middle (narrow support column)
    const middleMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|middle",
      { width: middleWidth, height: middleHeight, depth: middleDepth },
      this._scene
    );
    middleMesh.material = material;
    middleMesh.position.y = middleY;
    this._applyMeshSettings(middleMesh);
    parentMesh.addChild(middleMesh);

    // Anvil top (wide working surface)
    const topMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|top",
      { width: topWidth, height: topHeight, depth: topDepth },
      this._scene
    );
    topMesh.material = material;
    topMesh.position.y = topY;
    this._applyMeshSettings(topMesh);
    parentMesh.addChild(topMesh);

    return parentMesh;
  }

  createCandleMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Single candle (0.125 x 0.375 x 0.125)
    const candleWidth = 0.125; // 2 pixels
    const candleHeight = 0.375; // 6 pixels

    const candleMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|candle",
      { width: candleWidth, height: candleHeight, depth: candleWidth },
      this._scene
    );
    candleMesh.material = material;
    candleMesh.position.y = -0.5 + candleHeight / 2;
    this._applyMeshSettings(candleMesh);
    parentMesh.addChild(candleMesh);

    return parentMesh;
  }

  createLeverMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    // Use cobblestone material for base and oak planks for handle
    // The lever.png texture is a sprite with transparency and causes visual artifacts on 3D cubes
    const baseMaterial = this._ensureMaterialFromPath("textures/blocks/cobblestone");
    const handleMaterial = this._ensureMaterialFromPath("textures/blocks/planks_oak");

    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Lever base - cobblestone-like base: 6x4x6 pixels (0.375 x 0.25 x 0.375)
    const baseWidth = 0.375;
    const baseHeight = 0.25;
    const baseY = -0.5 + baseHeight / 2; // = -0.375

    const baseMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|base",
      { width: baseWidth, height: baseHeight, depth: baseWidth },
      this._scene
    );
    baseMesh.material = baseMaterial;
    baseMesh.position.y = baseY;
    this._applyMeshSettings(baseMesh);
    parentMesh.addChild(baseMesh);

    // Lever handle - a thin 3D stick
    const handleWidth = 0.125;
    const handleHeight = 0.5;

    const handleMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|handle",
      { width: handleWidth, height: handleHeight, depth: handleWidth },
      this._scene
    );
    handleMesh.material = handleMaterial;
    this._applyMeshSettings(handleMesh);

    // Position handle on top of base, tilted
    const tiltAngle = Math.PI / 6; // 30 degrees
    const pivotY = baseY + baseHeight / 2; // top of base
    handleMesh.position.y = pivotY + (handleHeight / 2) * Math.cos(tiltAngle);
    handleMesh.position.z = -(handleHeight / 2) * Math.sin(tiltAngle);
    handleMesh.rotation.x = -tiltAngle;

    parentMesh.addChild(handleMesh);

    return parentMesh;
  }

  createEndRodMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // End rod has two parts:
    // 1. Base/bulb: 4x1x4 pixels (0.25 x 0.0625 x 0.25)
    // 2. Rod: 2x15x2 pixels (0.125 x 0.9375 x 0.125)

    const baseWidth = 0.25; // 4 pixels
    const baseHeight = 0.0625; // 1 pixel
    const rodWidth = 0.125; // 2 pixels
    const rodHeight = 0.9375; // 15 pixels

    // Base bulb at the bottom
    const baseMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|base",
      { width: baseWidth, height: baseHeight, depth: baseWidth },
      this._scene
    );
    baseMesh.material = material;
    baseMesh.position.y = -0.5 + baseHeight / 2;
    this._applyMeshSettings(baseMesh);
    parentMesh.addChild(baseMesh);

    // The main rod extending upward
    const rodMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|rod",
      { width: rodWidth, height: rodHeight, depth: rodWidth },
      this._scene
    );
    rodMesh.material = material;
    // Position rod on top of base
    rodMesh.position.y = -0.5 + baseHeight + rodHeight / 2;
    this._applyMeshSettings(rodMesh);
    parentMesh.addChild(rodMesh);

    return parentMesh;
  }

  createCropMesh(name: string, block: Block) {
    // Crops use cross-billboard rendering similar to flowers
    return this.createBillboardMesh(name, block);
  }

  createBedMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Bed is 16x9x16 pixels (1.0 x 0.5625 x 1.0) - slightly shorter than half a block
    // Bed frame/mattress part
    const bedWidth = 1.0;
    const bedHeight = 0.5625; // 9 pixels
    const bedDepth = 1.0;

    const bedMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|bed",
      { width: bedWidth, height: bedHeight, depth: bedDepth },
      this._scene
    );
    bedMesh.material = material;
    // Position at the bottom of the block
    bedMesh.position.y = -0.5 + bedHeight / 2;
    this._applyMeshSettings(bedMesh);
    parentMesh.addChild(bedMesh);

    // Bed legs - 4 small posts at corners (3x3 pixels each, 3 pixels tall)
    const legSize = 0.1875; // 3 pixels
    const legHeight = 0.1875;
    const legOffset = 0.5 - legSize / 2;

    for (let xDir of [-1, 1]) {
      for (let zDir of [-1, 1]) {
        const legMesh = BABYLON.MeshBuilder.CreateBox(
          name + `|leg${xDir}${zDir}`,
          { width: legSize, height: legHeight, depth: legSize },
          this._scene
        );
        legMesh.material = material;
        legMesh.position.x = xDir * legOffset;
        legMesh.position.z = zDir * legOffset;
        legMesh.position.y = -0.5 + legHeight / 2;
        this._applyMeshSettings(legMesh);
        parentMesh.addChild(legMesh);
      }
    }

    return parentMesh;
  }

  createChestMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Chest body: 14x10x14 pixels (0.875 x 0.625 x 0.875)
    const bodyWidth = 0.875;
    const bodyHeight = 0.625;
    const bodyDepth = 0.875;

    const bodyMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|body",
      { width: bodyWidth, height: bodyHeight, depth: bodyDepth },
      this._scene
    );
    bodyMesh.material = material;
    bodyMesh.position.y = -0.5 + bodyHeight / 2;
    this._applyMeshSettings(bodyMesh);
    parentMesh.addChild(bodyMesh);

    // Chest lid: 14x5x14 pixels (0.875 x 0.3125 x 0.875)
    const lidHeight = 0.3125;

    const lidMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|lid",
      { width: bodyWidth, height: lidHeight, depth: bodyDepth },
      this._scene
    );
    lidMesh.material = material;
    lidMesh.position.y = -0.5 + bodyHeight + lidHeight / 2;
    this._applyMeshSettings(lidMesh);
    parentMesh.addChild(lidMesh);

    // Latch: small 2x4x1 pixel box on the front
    const latchWidth = 0.125;
    const latchHeight = 0.25;
    const latchDepth = 0.0625;

    const latchMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|latch",
      { width: latchWidth, height: latchHeight, depth: latchDepth },
      this._scene
    );
    latchMesh.material = material;
    latchMesh.position.y = -0.5 + bodyHeight - latchHeight / 2;
    latchMesh.position.z = bodyDepth / 2 + latchDepth / 2;
    this._applyMeshSettings(latchMesh);
    parentMesh.addChild(latchMesh);

    return parentMesh;
  }

  createCampfireMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Campfire has crossed logs at the base
    // Base logs: 4 horizontal logs arranged in a # pattern

    const logWidth = 1.0;
    const logHeight = 0.25; // 4 pixels
    const logDepth = 0.25; // 4 pixels

    // Two logs going one direction
    const log1 = BABYLON.MeshBuilder.CreateBox(
      name + "|log1",
      { width: logWidth, height: logHeight, depth: logDepth },
      this._scene
    );
    log1.material = material;
    log1.position.y = -0.5 + logHeight / 2;
    log1.position.z = 0.25;
    this._applyMeshSettings(log1);
    parentMesh.addChild(log1);

    const log2 = BABYLON.MeshBuilder.CreateBox(
      name + "|log2",
      { width: logWidth, height: logHeight, depth: logDepth },
      this._scene
    );
    log2.material = material;
    log2.position.y = -0.5 + logHeight / 2;
    log2.position.z = -0.25;
    this._applyMeshSettings(log2);
    parentMesh.addChild(log2);

    // Two logs going perpendicular direction, stacked on top
    const log3 = BABYLON.MeshBuilder.CreateBox(
      name + "|log3",
      { width: logDepth, height: logHeight, depth: logWidth },
      this._scene
    );
    log3.material = material;
    log3.position.y = -0.5 + logHeight + logHeight / 2;
    log3.position.x = 0.25;
    this._applyMeshSettings(log3);
    parentMesh.addChild(log3);

    const log4 = BABYLON.MeshBuilder.CreateBox(
      name + "|log4",
      { width: logDepth, height: logHeight, depth: logWidth },
      this._scene
    );
    log4.material = material;
    log4.position.y = -0.5 + logHeight + logHeight / 2;
    log4.position.x = -0.25;
    this._applyMeshSettings(log4);
    parentMesh.addChild(log4);

    return parentMesh;
  }

  createBellMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    // Use stone for the bar and gold for the bell body - the bell.png texture is a sparse sprite
    const barMaterial = this._ensureMaterialFromPath("textures/blocks/stone");
    const bellMaterial = this._ensureMaterialFromPath("textures/blocks/gold_block");
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Bell consists of:
    // 1. Stone bar/beam at top (for hanging)
    // 2. Bell body (tapered)

    // Top bar: 12x2x2 pixels (0.75 x 0.125 x 0.125)
    const barWidth = 0.75;
    const barHeight = 0.125;

    const barMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|bar",
      { width: barWidth, height: barHeight, depth: barHeight },
      this._scene
    );
    barMesh.material = barMaterial;
    barMesh.position.y = 0.5 - barHeight / 2;
    this._applyMeshSettings(barMesh);
    parentMesh.addChild(barMesh);

    // Bell body (main part): 8x10x8 pixels (0.5 x 0.625 x 0.5)
    const bellWidth = 0.5;
    const bellHeight = 0.625;

    const bellMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|bell",
      { width: bellWidth, height: bellHeight, depth: bellWidth },
      this._scene
    );
    bellMesh.material = bellMaterial;
    bellMesh.position.y = 0.5 - barHeight - bellHeight / 2;
    this._applyMeshSettings(bellMesh);
    parentMesh.addChild(bellMesh);

    // Bell rim (wider at bottom): 10x2x10 pixels (0.625 x 0.125 x 0.625)
    const rimWidth = 0.625;
    const rimHeight = 0.125;

    const rimMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|rim",
      { width: rimWidth, height: rimHeight, depth: rimWidth },
      this._scene
    );
    rimMesh.material = bellMaterial;
    rimMesh.position.y = 0.5 - barHeight - bellHeight - rimHeight / 2;
    this._applyMeshSettings(rimMesh);
    parentMesh.addChild(rimMesh);

    return parentMesh;
  }

  createHopperMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    // Use cauldron textures - the hopper texture is a sparse sprite
    const material = this._ensureMaterialFromPath("textures/blocks/cauldron_side");
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Hopper has a funnel shape: wide at top, narrow at bottom
    // Top rim: 16x4x16 pixels (1.0 x 0.25 x 1.0)
    const topWidth = 1.0;
    const topHeight = 0.25;

    const topMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|top",
      { width: topWidth, height: topHeight, depth: topWidth },
      this._scene
    );
    topMesh.material = material;
    topMesh.position.y = 0.5 - topHeight / 2;
    this._applyMeshSettings(topMesh);
    parentMesh.addChild(topMesh);

    // Middle funnel section: 8x6x8 pixels (0.5 x 0.375 x 0.5)
    const midWidth = 0.5;
    const midHeight = 0.375;

    const midMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|middle",
      { width: midWidth, height: midHeight, depth: midWidth },
      this._scene
    );
    midMesh.material = material;
    midMesh.position.y = 0.5 - topHeight - midHeight / 2;
    this._applyMeshSettings(midMesh);
    parentMesh.addChild(midMesh);

    // Bottom spout: 4x6x4 pixels (0.25 x 0.375 x 0.25)
    const spoutWidth = 0.25;
    const spoutHeight = 0.375;

    const spoutMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|spout",
      { width: spoutWidth, height: spoutHeight, depth: spoutWidth },
      this._scene
    );
    spoutMesh.material = material;
    spoutMesh.position.y = 0.5 - topHeight - midHeight - spoutHeight / 2;
    this._applyMeshSettings(spoutMesh);
    parentMesh.addChild(spoutMesh);

    return parentMesh;
  }

  createBrewingStandMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Get separate materials for base and rod
    const baseTexPath = ProjectDefinitionUtilities.getVanillaBlockTexture(block.blockType, "down");
    const rodTexPath = ProjectDefinitionUtilities.getVanillaBlockTexture(block.blockType, "side");

    const baseMaterial = baseTexPath
      ? this._ensureMaterialFromPath(baseTexPath)
      : this._ensureBoxMaterial(block.blockType);
    const rodMaterial = rodTexPath
      ? this._ensureMaterialFromPath(rodTexPath)
      : this._ensureBoxMaterial(block.blockType);

    // Brewing stand has:
    // 1. A flat base plate (the base texture shows a 3-pronged shape)
    // 2. A central blaze rod pole
    // 3. Three arms extending outward (simplified as small boxes)

    // Base plate: flat like a carpet, using the base texture
    // The base is roughly 9x1x9 pixels at center
    const baseWidth = 0.5625; // 9 pixels
    const baseHeight = 0.0625; // 1 pixel
    const baseDepth = 0.5625;

    const baseMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|base",
      { width: baseWidth, height: baseHeight, depth: baseDepth },
      this._scene
    );
    baseMesh.material = baseMaterial;
    baseMesh.position.y = -0.5 + baseHeight / 2;
    this._applyMeshSettings(baseMesh);
    parentMesh.addChild(baseMesh);

    // Three prong feet extending outward from base (simplified representation)
    const footLength = 0.375; // 6 pixels
    const footWidth = 0.125; // 2 pixels
    const footHeight = 0.0625; // 1 pixel

    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3; // 120 degrees apart
      const footMesh = BABYLON.MeshBuilder.CreateBox(
        name + `|foot${i}`,
        { width: footLength, height: footHeight, depth: footWidth },
        this._scene
      );
      footMesh.material = baseMaterial;
      footMesh.position.x = Math.cos(angle) * (baseWidth / 2 + footLength / 2 - 0.05);
      footMesh.position.z = Math.sin(angle) * (baseWidth / 2 + footLength / 2 - 0.05);
      footMesh.position.y = -0.5 + footHeight / 2;
      footMesh.rotation.y = angle;
      this._applyMeshSettings(footMesh);
      parentMesh.addChild(footMesh);
    }

    // Central rod (blaze rod): thin vertical cylinder-like shape
    // Using crossed planes for a more accurate look
    const rodWidth = 0.125; // 2 pixels
    const rodHeight = 0.875; // 14 pixels

    const rodOptions = {
      width: rodWidth,
      height: rodHeight,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
    };

    const rodMesh1 = BABYLON.MeshBuilder.CreatePlane(name + "|rod1", rodOptions, this._scene);
    const rodMesh2 = BABYLON.MeshBuilder.CreatePlane(name + "|rod2", rodOptions, this._scene);
    rodMesh1.material = rodMaterial;
    rodMesh2.material = rodMaterial;

    rodMesh1.position.y = -0.5 + baseHeight + rodHeight / 2;
    rodMesh2.position.y = -0.5 + baseHeight + rodHeight / 2;

    rodMesh1.rotation.y = Math.PI / 4;
    rodMesh2.rotation.y = -Math.PI / 4;

    this._applyMeshSettings(rodMesh1);
    this._applyMeshSettings(rodMesh2);
    parentMesh.addChild(rodMesh1);
    parentMesh.addChild(rodMesh2);

    return parentMesh;
  }

  createEnchantingTableMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Enchanting table: 16x12x16 pixels (1.0 x 0.75 x 1.0)
    // It's a 3/4 height block with a book on top
    const tableWidth = 1.0;
    const tableHeight = 0.75; // 12 pixels - 3/4 of a block

    const tableMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|table",
      { width: tableWidth, height: tableHeight, depth: tableWidth },
      this._scene
    );
    tableMesh.material = material;
    tableMesh.position.y = -0.5 + tableHeight / 2;
    this._applyMeshSettings(tableMesh);
    parentMesh.addChild(tableMesh);

    return parentMesh;
  }

  createCauldronMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const material = this._ensureBoxMaterial(block.blockType);
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Cauldron is a hollow container with thick walls
    // Outer dimensions: 16x16x16, inner hollow space
    // Wall thickness: 2 pixels = 0.125

    const wallThickness = 0.125;
    const bottomHeight = 0.25; // 4 pixels for the bottom

    // Bottom of cauldron
    const bottomMesh = BABYLON.MeshBuilder.CreateBox(
      name + "|bottom",
      { width: 1.0, height: bottomHeight, depth: 1.0 },
      this._scene
    );
    bottomMesh.material = material;
    bottomMesh.position.y = -0.5 + bottomHeight / 2;
    this._applyMeshSettings(bottomMesh);
    parentMesh.addChild(bottomMesh);

    const sideHeight = 1.0 - bottomHeight;

    // Four walls
    // Front wall
    const frontWall = BABYLON.MeshBuilder.CreateBox(
      name + "|front",
      { width: 1.0, height: sideHeight, depth: wallThickness },
      this._scene
    );
    frontWall.material = material;
    frontWall.position.y = -0.5 + bottomHeight + sideHeight / 2;
    frontWall.position.z = 0.5 - wallThickness / 2;
    this._applyMeshSettings(frontWall);
    parentMesh.addChild(frontWall);

    // Back wall
    const backWall = BABYLON.MeshBuilder.CreateBox(
      name + "|back",
      { width: 1.0, height: sideHeight, depth: wallThickness },
      this._scene
    );
    backWall.material = material;
    backWall.position.y = -0.5 + bottomHeight + sideHeight / 2;
    backWall.position.z = -0.5 + wallThickness / 2;
    this._applyMeshSettings(backWall);
    parentMesh.addChild(backWall);

    // Left wall
    const leftWall = BABYLON.MeshBuilder.CreateBox(
      name + "|left",
      { width: wallThickness, height: sideHeight, depth: 1.0 - 2 * wallThickness },
      this._scene
    );
    leftWall.material = material;
    leftWall.position.y = -0.5 + bottomHeight + sideHeight / 2;
    leftWall.position.x = -0.5 + wallThickness / 2;
    this._applyMeshSettings(leftWall);
    parentMesh.addChild(leftWall);

    // Right wall
    const rightWall = BABYLON.MeshBuilder.CreateBox(
      name + "|right",
      { width: wallThickness, height: sideHeight, depth: 1.0 - 2 * wallThickness },
      this._scene
    );
    rightWall.material = material;
    rightWall.position.y = -0.5 + bottomHeight + sideHeight / 2;
    rightWall.position.x = 0.5 - wallThickness / 2;
    this._applyMeshSettings(rightWall);
    parentMesh.addChild(rightWall);

    // Small feet at corners (optional for visual detail)
    const legSize = 0.1875; // 3 pixels
    const legHeight = 0.1875;
    const legOffset = 0.5 - legSize / 2;

    for (let xDir of [-1, 1]) {
      for (let zDir of [-1, 1]) {
        const legMesh = BABYLON.MeshBuilder.CreateBox(
          name + `|leg${xDir}${zDir}`,
          { width: legSize, height: legHeight, depth: legSize },
          this._scene
        );
        legMesh.material = material;
        legMesh.position.x = xDir * legOffset;
        legMesh.position.z = zDir * legOffset;
        legMesh.position.y = -0.5 + legHeight / 2;
        this._applyMeshSettings(legMesh);
        parentMesh.addChild(legMesh);
      }
    }

    return parentMesh;
  }

  /**
   * Creates a mesh for big dripleaf blocks.
   * The big dripleaf has a large tilted leaf head at the top and a thin vertical stem.
   */
  createDripleafMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined || block.blockType === undefined) {
      return undefined;
    }

    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Get the top texture for the leaf head
    let topTexPath = ProjectDefinitionUtilities.getVanillaBlockTexture(block.blockType, "east");
    if (!topTexPath) {
      topTexPath = ProjectDefinitionUtilities.getVanillaBlockTexture(block.blockType, "up");
    }

    // Get the stem texture
    let stemTexPath = ProjectDefinitionUtilities.getVanillaBlockTexture(block.blockType, "north");
    if (!stemTexPath) {
      stemTexPath = ProjectDefinitionUtilities.getVanillaBlockTexture(block.blockType, "side");
    }

    // Create the large tilted leaf head (like a lily pad but tilted)
    // The leaf is roughly 14x14 pixels in size, slightly less than a full block
    const leafSize = 0.875; // 14 pixels = 0.875 blocks

    const leafOptions = {
      width: leafSize,
      height: leafSize,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const leafMesh = BABYLON.MeshBuilder.CreatePlane(name + "|leaf", leafOptions, this._scene);

    if (topTexPath) {
      const leafMaterial = this._ensureMaterialFromPath(topTexPath);
      leafMesh.material = leafMaterial;
    }

    // Position the leaf at the top of the block, slightly tilted
    // The dripleaf head tilts slightly forward/backward
    leafMesh.position.y = 0.4; // Near the top but not at the very top
    leafMesh.rotation.x = Math.PI / 2; // Lay flat (horizontal)
    leafMesh.rotation.z = -Math.PI / 16; // Slight tilt for natural look

    this._applyMeshSettings(leafMesh);
    parentMesh.addChild(leafMesh);

    // Create the stem - a thin vertical column
    // Stem is roughly 4x4 pixels thick
    const stemWidth = 0.25; // 4 pixels
    const stemHeight = 0.9; // Most of the block height

    const stemOptions = {
      width: stemWidth,
      height: stemWidth,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    // Create two crossed planes for the stem (billboard-style)
    const stemMesh1 = BABYLON.MeshBuilder.CreatePlane(
      name + "|stem1",
      { width: stemWidth, height: stemHeight, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
      this._scene
    );
    const stemMesh2 = BABYLON.MeshBuilder.CreatePlane(
      name + "|stem2",
      { width: stemWidth, height: stemHeight, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
      this._scene
    );

    if (stemTexPath) {
      const stemMaterial = this._ensureMaterialFromPath(stemTexPath);
      stemMesh1.material = stemMaterial;
      stemMesh2.material = stemMaterial;
    }

    // Position stems at center, going down from the leaf
    stemMesh1.position.y = -0.05; // Centered vertically below the leaf
    stemMesh2.position.y = -0.05;

    // Rotate stems to form an X pattern (crossed planes)
    stemMesh1.rotation.y = Math.PI / 4;
    stemMesh2.rotation.y = -Math.PI / 4;

    this._applyMeshSettings(stemMesh1);
    this._applyMeshSettings(stemMesh2);
    parentMesh.addChild(stemMesh1);
    parentMesh.addChild(stemMesh2);

    return parentMesh;
  }

  createUnitCubeMesh(name: string, block: Block) {
    if (block.shortTypeId === undefined) {
      return undefined;
    }

    const blockType = block.blockType;

    if (!blockType) {
      throw new Error("Undefined block type for simple block mesh");
    }

    const material = this._ensureBoxMaterialAndUvFromBlockType(blockType);

    return this._createBlockMesh(name, block, material, 1, 1, 1);
  }

  /**
   * Creates a textured unit cube mesh for the given block type name (e.g., "stone", "grass_block").
   * This is the public API for ChunkMeshBuilder/WorldRenderer to create template meshes
   * that share the same texture resolution pipeline as VolumeEditor.
   *
   * The returned mesh uses the full texture resolution chain:
   *   blockTypeName → Database.ensureBlockType → ProjectDefinitionUtilities.getVanillaBlockTexture
   *   → terrain_texture.json → PNG URL → Babylon.js material
   *
   * Returns undefined if the block type is unknown or has no texture.
   */
  public createTexturedBlockMesh(
    meshName: string,
    blockTypeName: string,
    forceSingleMaterial?: boolean,
    preferTopFace?: boolean
  ): BABYLON.Mesh | undefined {
    const blockType = Database.ensureBlockType(blockTypeName);
    if (!blockType) return undefined;

    const block = new Block();
    block.setType(blockType);

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(blockType);
    if (!bmau) return undefined;

    // When forceSingleMaterial is set, override multi-face strategy to use
    // a single material. This is needed for ChunkMeshBuilder's thin instance
    // rendering which is incompatible with MultiMaterial mesh geometry.
    if (forceSingleMaterial && bmau.strategy !== BoxMaterialStrategy.uniform) {
      const face = preferTopFace ? BoxSide.up : BoxSide.left;
      const faceMat = bmau.getMaterialAndUv(face).material;
      const sourceMesh = BABYLON.MeshBuilder.CreateBox(meshName, this._createBoxOptions(1, 1, 1), this._scene);
      sourceMesh.material = faceMat;
      this._applyMeshSettings(sourceMesh);
      return sourceMesh;
    }

    return this._createBlockMesh(meshName, block, bmau, 1, 1, 1);
  }

  /**
   * Gets the BoxMaterialAndUv for a block type name, exposing the material resolution
   * pipeline for use by ChunkMeshBuilder and other renderers that need block materials
   * without creating a full mesh.
   */
  public getBlockMaterial(blockTypeName: string): BoxMaterialAndUv | undefined {
    const blockType = Database.ensureBlockType(blockTypeName);
    if (!blockType) return undefined;
    return this._ensureBoxMaterialAndUvFromBlockType(blockType);
  }

  /**
   * Gets the BlockShape for a block type name from the Database catalog.
   * Returns undefined if the block type is unknown.
   */
  public getBlockShape(blockTypeName: string): BlockShape | undefined {
    const blockType = Database.ensureBlockType(blockTypeName);
    if (!blockType) return undefined;
    return blockType.baseType?.shape;
  }

  /**
   * Creates a billboard (X-shaped cross) mesh for vegetation blocks like flowers,
   * saplings, tall grass, mushrooms, dead bush, etc.
   * Two perpendicular planes at ±45° angles with the block's texture applied.
   */
  public createTexturedBillboardMesh(meshName: string, blockTypeName: string): BABYLON.Mesh | undefined {
    const blockType = Database.ensureBlockType(blockTypeName);
    if (!blockType) return undefined;

    let texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "up");
    if (!texPath) {
      texPath = ProjectDefinitionUtilities.getVanillaBlockTexture(blockType, "side");
    }
    if (!texPath) return undefined;

    const material = this._ensureMaterialFromPath(texPath);
    // Enable alpha for vegetation transparency — override the opaque defaults
    // from _ensureMaterialFromPath since vegetation textures have alpha cutouts
    if (material instanceof BABYLON.StandardMaterial) {
      material.unfreeze();
      if (material.diffuseTexture) {
        (material.diffuseTexture as BABYLON.Texture).hasAlpha = true;
      }
      material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
      material.alphaCutOff = 0.3;
      material.useAlphaFromDiffuseTexture = true;
      material.backFaceCulling = false;
      material.freeze();
    }

    const planeOpts = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    // Create two perpendicular planes forming an X and merge into single mesh
    // so thin instances work (parent mesh has geometry, not child planes)
    const planeA = BABYLON.MeshBuilder.CreatePlane(meshName + "_a", planeOpts, this._scene);
    planeA.rotation.y = Math.PI / 4;
    planeA.bakeCurrentTransformIntoVertices();

    const planeB = BABYLON.MeshBuilder.CreatePlane(meshName + "_b", planeOpts, this._scene);
    planeB.rotation.y = -Math.PI / 4;
    planeB.bakeCurrentTransformIntoVertices();

    const merged = BABYLON.Mesh.MergeMeshes([planeA, planeB], true, true, undefined, false, true);
    if (!merged) return undefined;

    merged.name = meshName;
    merged.material = material;

    return merged;
  }

  /**
   * Creates a half-height slab mesh with the block's texture.
   * Bottom slab by default (occupies lower half of the block space).
   */
  public createTexturedSlabMesh(meshName: string, blockTypeName: string): BABYLON.Mesh | undefined {
    const blockType = Database.ensureBlockType(blockTypeName);
    if (!blockType) return undefined;

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(blockType);
    if (!bmau) return undefined;

    const block = new Block();
    block.setType(blockType);

    // Create a half-height box (slab)
    const mesh = this._createBlockMesh(meshName, block, bmau, 1, 0.5, 1);
    if (mesh) {
      mesh.position.y = -0.25; // Position at bottom half
    }
    return mesh;
  }

  /**
   * Creates a thin center post mesh (0.25×1.0×0.25) for fence/wall blocks.
   * Without block state data for neighbor connections, renders just the center post.
   */
  public createTexturedFencePostMesh(meshName: string, blockTypeName: string): BABYLON.Mesh | undefined {
    const blockType = Database.ensureBlockType(blockTypeName);
    if (!blockType) return undefined;

    const bmau = this._ensureBoxMaterialAndUvFromBlockType(blockType);
    if (!bmau) return undefined;

    const block = new Block();
    block.setType(blockType);

    return this._createBlockMesh(meshName, block, bmau, 0.25, 1, 0.25);
  }

  _createBlockMesh(
    name: string,
    block: Block,
    boxMaterialAndUv: BoxMaterialAndUv,
    xExtent: number,
    yExtent: number,
    zExtent: number
  ) {
    let singleUVTexture = false;

    const opaqueSideCount = block.opaqueSideCount;

    // If no surroundings set (standalone block), assume all 6 sides should be visible
    // opaqueSideCount returns 0 for standalone blocks without cube context
    const isStandaloneBlock = opaqueSideCount === 0 && block.surroundings === undefined;

    if (opaqueSideCount === 0 && !isStandaloneBlock) {
      return undefined;
    } else if (opaqueSideCount === 6 || isStandaloneBlock) {
      // All 6 sides are visible (or standalone block), create a full box
      if (boxMaterialAndUv.strategy !== BoxMaterialStrategy.uniform) {
        // Multi-material box: side/top/bottom have different textures (e.g., grass_block)
        // Babylon.js box face order: front(0), back(1), right(2), left(3), top(4), bottom(5)
        // Each face has 6 indices (2 triangles × 3 vertices)
        const sourceMesh = BABYLON.MeshBuilder.CreateBox(
          name,
          this._createBoxOptions(xExtent, yExtent, zExtent),
          this._scene
        );

        const multiMat = new BABYLON.MultiMaterial("multi_" + name, this._scene);
        const sideMat = boxMaterialAndUv.getMaterialAndUv(BoxSide.left).material;
        const topMat = boxMaterialAndUv.getMaterialAndUv(BoxSide.up).material;
        const bottomMat = boxMaterialAndUv.getMaterialAndUv(BoxSide.down).material;
        multiMat.subMaterials = [sideMat, sideMat, sideMat, sideMat, topMat, bottomMat];

        sourceMesh.material = multiMat;
        sourceMesh.subMeshes = [];
        const vertCount = sourceMesh.getTotalVertices();
        for (let i = 0; i < 6; i++) {
          new BABYLON.SubMesh(i, 0, vertCount, i * 6, 6, sourceMesh);
        }

        this._applyMeshSettings(sourceMesh);
        return sourceMesh;
      }

      const defaultMatUv = boxMaterialAndUv.getDefaultMaterialAndUv();
      const sourceMesh = BABYLON.MeshBuilder.CreateBox(
        name,
        this._createBoxOptions(xExtent, yExtent, zExtent, [defaultMatUv.uv]),
        this._scene
      );

      if (block.shortTypeId !== undefined) {
        sourceMesh.material = defaultMatUv.material;
      }

      this._applyMeshSettings(sourceMesh);

      return sourceMesh;
    }

    // Some sides are hidden by opaque neighbors, only render visible planes
    return this._createBlockPlaneMesh(name, block, boxMaterialAndUv, singleUVTexture, undefined);
  }

  _createBlockPlaneMesh(
    name: string,
    block: Block,
    boxMaterialAndUv: BoxMaterialAndUv,
    singleUV: boolean,
    faceUV?: BABYLON.Vector4[]
  ) {
    const surround = block.surroundings;

    if (
      surround === undefined ||
      block === undefined ||
      block.x === undefined ||
      block.y === undefined ||
      block.z === undefined
    ) {
      return undefined;
    }

    const parentMesh = new BABYLON.Mesh(name, this._scene);

    this._applyMeshSettings(parentMesh);

    const defaultOptions = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DEFAULTSIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const shortTypeName = block.shortTypeId;
    const waterLevel = block.effectiveWaterLevel;

    if (
      surround.backward === undefined ||
      surround.backward.isEmpty ||
      (!surround.backward.isOpaque &&
        surround.backward.shortTypeId !== shortTypeName &&
        (waterLevel < 16 || surround.backward.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matuv = boxMaterialAndUv.getMaterialAndUv(BoxSide.backward);
      let matToApply = matuv.material;

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: matuv.uv,
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|b", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);
      planeMesh.position.z = -0.499; // Slightly inset to prevent z-fighting at boundaries
      planeMesh.rotation.y = Math.PI;
    }

    if (
      surround.forward === undefined ||
      surround.forward.isEmpty ||
      (!surround.forward.isOpaque &&
        surround.forward.shortTypeId !== shortTypeName &&
        (waterLevel < 16 || surround.forward.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;

      let matuv = boxMaterialAndUv.getMaterialAndUv(BoxSide.forward);
      const matToApply = matuv.material;

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: matuv.uv,
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|f", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);

      parentMesh.addChild(planeMesh);
      planeMesh.position.z = 0.499; // Slightly inset to prevent z-fighting at boundaries
    }

    if (
      surround.left === undefined ||
      surround.left.isEmpty ||
      (!surround.left.isOpaque &&
        surround.left.shortTypeId !== shortTypeName &&
        (waterLevel < 16 || surround.left.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matuv = boxMaterialAndUv.getMaterialAndUv(BoxSide.left);

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: matuv.uv,
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|l", options, this._scene);
      planeMesh.material = matuv.material;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.x = +0.499; // Slightly inset to prevent z-fighting at boundaries
      planeMesh.rotation.y = -(Math.PI / 2);
    }

    if (
      surround.right === undefined ||
      surround.right.isEmpty ||
      (!surround.right.isOpaque &&
        surround.right.shortTypeId !== shortTypeName &&
        (waterLevel < 16 || surround.right.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matuv = boxMaterialAndUv.getMaterialAndUv(BoxSide.right);
      let matToApply = matuv.material;

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: matuv.uv,
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|r", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.x = -0.499; // Slightly inset to prevent z-fighting at boundaries
      planeMesh.rotation.y = Math.PI / 2;
    }

    if (
      surround.up === undefined ||
      surround.up.isEmpty ||
      (!surround.up.isOpaque &&
        surround.up.shortTypeId !== shortTypeName &&
        (waterLevel < 16 || surround.up.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matuv = boxMaterialAndUv.getMaterialAndUv(BoxSide.up);
      let matToApply = matuv.material;

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: matuv.uv,
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|u", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.y = 0.499; // Slightly inset to prevent z-fighting at boundaries
      planeMesh.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2, BABYLON.Space.WORLD);
    }

    if (
      surround.down === undefined ||
      surround.down.isEmpty ||
      (!surround.down.isOpaque &&
        surround.down.shortTypeId !== shortTypeName &&
        (waterLevel < 16 || surround.down.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matuv = boxMaterialAndUv.getMaterialAndUv(BoxSide.down);
      let matToApply = matuv.material;

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: matuv.uv,
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|d", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.y = -0.499; // Slightly inset to prevent z-fighting at boundaries
      planeMesh.rotate(new BABYLON.Vector3(1, 0, 0), (Math.PI * 3) / 2, BABYLON.Space.WORLD);
    }

    return parentMesh;
  }

  _applyMeshSettings(mesh: BABYLON.Mesh) {
    //        mesh.occlusionRetryCount = -1;
    //        mesh.occlusionQueryAlgorithmType = BABYLON.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_CONSERVATIVE;
    //        mesh.occlusionType = BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
    //        mesh.isOccluded = true;

    mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
  }

  createBoundingMesh(name: string) {
    if (this._boundingMesh === undefined) {
      this._boundingMesh = BABYLON.MeshBuilder.CreateBox(name, this._createBoxOptions(1, 1, 1), this._scene);
      this._boundingMesh.isVisible = false;

      /*const clearMaterial = new BABYLON.StandardMaterial("transparent", this._scene);
            clearMaterial.alpha = 0.0;
            clearMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
            this._boundingMesh.material = clearMaterial;*/
    }

    return this._boundingMesh.clone(name, null) as BABYLON.Mesh;
  }

  _ensureBoxMaterial(vanillaBlockType: BlockType): BABYLON.StandardMaterial {
    let blockTypeShortId = vanillaBlockType.shortId;

    let mat = this._materials.get(blockTypeShortId);

    if (!mat) {
      let tex = ProjectDefinitionUtilities.getVanillaBlockTexture(vanillaBlockType, "up");

      if (typeof tex === "string") {
        mat = this._ensureMaterialFromPath(tex);
        this._materials.set(blockTypeShortId, mat);
      } else {
        const catalogRes = vanillaBlockType.catalogResource;
        Log.debug(
          `BlockMeshFactory: No texture found for ${blockTypeShortId}, material=${
            vanillaBlockType.material
          }, catalogResource=${!!catalogRes}`
        );
      }
    }

    if (!mat) {
      // Use a fallback magenta debug material instead of throwing
      mat = this._ensureFallbackMaterial();
    }

    return mat;
  }

  _ensureFallbackMaterial(): BABYLON.StandardMaterial {
    let mat = this._materials.get("__fallback__");

    if (this._scene === null) {
      throw new Error("Scene is null in ensureFallbackMaterial");
    }

    if (!mat) {
      mat = new BABYLON.StandardMaterial("mat.__fallback__", this._scene);
      mat.alpha = 1.0;
      mat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Neutral gray
      mat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Minimal emissive for subtle lighting
      mat.backFaceCulling = true;
      mat.zOffset = -2; // Prevent z-fighting with coplanar surfaces
      this._materials.set("__fallback__", mat);
      mat.freeze();
    }

    return mat;
  }

  _ensureMaterialFromPath(blockPath: string) {
    let mat = this._materials.get(blockPath);

    if (this._scene === null) {
      throw new Error("Scene is null in ensureMaterialFromPath");
    }

    if (!mat) {
      mat = new BABYLON.StandardMaterial("mat." + blockPath, this._scene);
      mat.alpha = 1.0;

      let path = CreatorToolsHost.getVanillaContentRoot() + "res/latest/van/serve/resource_pack/" + blockPath + ".png";

      Log.verbose("[BlockMeshFactory] Loading texture: " + blockPath);

      const texture = new BABYLON.Texture(path, this._scene, true, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
      texture.anisotropicFilteringLevel = 1;
      texture.hasAlpha = false;
      texture.uScale = 1;
      texture.vScale = -1;

      // Handle missing textures — fallback to diffuse color instead of red-black checkerboard
      const boundMat = mat;
      texture.onLoadObservable.addOnce(() => {});
      (texture as any)._onError = () => {
        boundMat.unfreeze();
        boundMat.diffuseTexture = null;
        boundMat.freeze();
      };

      mat.diffuseTexture = texture;
      mat.backFaceCulling = true;
      mat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
      mat.zOffset = -2;
      mat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;

      this._materials.set(blockPath, mat);
      mat.freeze();

      // Fix premultiplied alpha: re-upload texture data without premultiplication
      // to restore original RGB values for Bedrock PBR textures (see _fixTexturePremultiply).
      this._fixTexturePremultiply(path, texture, mat);
    }

    return mat;
  }

  _ensureMaterialRegularSideUp(name: string) {
    let mat = this._materials.get(name);

    if (!mat) {
      mat = new BABYLON.StandardMaterial("mat." + name, this._scene);
      mat.alpha = 1.0;

      const path =
        CreatorToolsHost.getVanillaContentRoot() +
        "res/latest/van/serve/resource_pack/textures/blocks/" +
        name +
        ".png";

      const texture = new BABYLON.Texture(path, this._scene, true, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
      texture.anisotropicFilteringLevel = 1;
      texture.hasAlpha = false;

      mat.diffuseTexture = texture;
      mat.backFaceCulling = true;
      mat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
      mat.zOffset = -2;
      mat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;

      this._materials.set(name, mat);
      mat.freeze();

      this._fixTexturePremultiply(path, texture, mat);
    }

    return mat;
  }

  /**
   * Re-upload texture data to WebGL without premultiplied alpha.
   *
   * Bedrock PBR textures store heightmap data in the alpha channel. The browser
   * premultiplies RGB by alpha during PNG decode, destroying color data for pixels
   * with low heightmap values (e.g., TNT's gray label area becomes black).
   *
   * Fix: fetch the PNG again, decode via createImageBitmap with premultiplyAlpha:'none',
   * and re-upload the correct pixel data directly to the existing WebGL texture handle.
   * Uses gl.texImage2D with the ImageBitmap directly (bypasses Canvas 2D which would
   * re-premultiply). Falls back gracefully if the fixup fails.
   */
  private _fixTexturePremultiply(path: string, texture: BABYLON.Texture, mat: BABYLON.StandardMaterial): void {
    if (typeof createImageBitmap === "undefined" || typeof fetch === "undefined") {
      return;
    }

    fetch(path)
      .then((resp) => {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.blob();
      })
      .then((blob) => createImageBitmap(blob, { premultiplyAlpha: "none" }))
      .then((bitmap) => {
        const doReupload = () => {
          const internalTex = texture._texture;
          if (!internalTex) {
            bitmap.close();
            return;
          }

          const engine = this._scene!.getEngine();
          const gl = (engine as any)._gl as WebGL2RenderingContext | undefined;
          if (!gl) {
            bitmap.close();
            return;
          }

          // Babylon v8 stores the WebGL handle at _hardwareTexture.underlyingResource
          const hwTex = (internalTex as any)._hardwareTexture;
          const webglTex = hwTex?.underlyingResource;
          if (!webglTex) {
            bitmap.close();
            return;
          }

          // Re-upload the non-premultiplied ImageBitmap directly to WebGL.
          // This bypasses Canvas 2D (which would re-premultiply the data).
          gl.bindTexture(gl.TEXTURE_2D, webglTex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, internalTex.invertY ? 1 : 0);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

          // Restore WebGL defaults
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

          bitmap.close();

          // Nudge the material so Babylon re-renders with the corrected texture
          mat.unfreeze();
          mat.freeze();
        };

        // Check if Babylon's texture is already loaded
        const internalTex = texture._texture;
        const hwTex = internalTex && (internalTex as any)._hardwareTexture;
        if (hwTex?.underlyingResource) {
          doReupload();
        } else {
          // Wait for Babylon's texture load to complete
          texture.onLoadObservable.addOnce(doReupload);
        }
      })
      .catch(() => {
        // Silently fail — texture still works, just with premultiply artifacts
      });
  }

  _createBoxOptions(width: number, height: number, depth: number, faceUV?: BABYLON.Vector4[] | undefined) {
    const options = {
      width: width,
      height: height,
      depth: depth,
      updatable: false,
      faceUV: faceUV,
    };

    return options;
  }
}
