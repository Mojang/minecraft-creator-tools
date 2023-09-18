import Block from "../minecraft/Block";
import * as BABYLON from "babylonjs";
import IBlockCubeBounds from "../minecraft/IBlockCubeBounds";
import Log from "../core/Log";
import CartoApp from "../app/CartoApp";

export default class BlockMeshFactory {
  _materials: { [id: string]: BABYLON.StandardMaterial } = {};
  _boundingMesh: BABYLON.Mesh | undefined;
  _scene: BABYLON.Scene;
  _bounds: IBlockCubeBounds;

  constructor(scene: BABYLON.Scene, bounds: IBlockCubeBounds) {
    this._scene = scene;
    this._bounds = bounds;
  }

  public getAppearanceHash(block: Block): string {
    if (block.shortTypeName === undefined) {
      Log.unexpectedUndefined("GAH");
      return "";
    }

    const waterLevel = block.effectiveWaterLevel;
    let base = block.shortTypeName + String.fromCharCode(48 + waterLevel) + "." + block.data + ".";

    if (block.bedrockType !== undefined && block.x !== undefined && block.y !== undefined && block.z !== undefined) {
      const shortTypeName = block.shortTypeName;
      const surround = block.surroundings;

      if (surround !== undefined) {
        let waterCode = 0;
        let nextWaterLevel = 0;

        //   if (blockBaseType.isCovering) {
        let blockOpacityCode = 0;

        if (
          surround.up === undefined ||
          surround.up.isEmpty ||
          (!surround.up.isOpaque &&
            surround.up.shortTypeName !== shortTypeName &&
            (waterLevel < 16 || surround.up.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode++;
        }

        if (nextWaterLevel >= 16) {
          waterCode++;
        }

        if (
          surround.down === undefined ||
          surround.down.isEmpty ||
          (!surround.down.isOpaque &&
            surround.down.shortTypeName !== shortTypeName &&
            (waterLevel < 16 || surround.down.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 2;
        }

        if (nextWaterLevel >= 16) {
          waterCode += 2;
        }

        if (
          surround.left === undefined ||
          surround.left.isEmpty ||
          (!surround.left.isOpaque &&
            surround.left.shortTypeName !== shortTypeName &&
            (waterLevel < 16 || surround.left.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 4;
        }

        if (nextWaterLevel >= 16) {
          waterCode += 4;
        }

        if (
          surround.right === undefined ||
          surround.right.isEmpty ||
          (!surround.right.isOpaque &&
            surround.right.shortTypeName !== shortTypeName &&
            (waterLevel < 16 || surround.right.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 8;
        }

        if (nextWaterLevel >= 16) {
          waterCode += 8;
        }

        if (
          surround.forward === undefined ||
          surround.forward.isEmpty ||
          (!surround.forward.isOpaque &&
            surround.forward.shortTypeName !== shortTypeName &&
            (waterLevel < 16 || surround.forward.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 16;
        }

        if (nextWaterLevel >= 16) {
          waterCode += 16;
        }

        if (
          surround.backward === undefined ||
          surround.backward.isEmpty ||
          (!surround.backward.isOpaque &&
            surround.backward.shortTypeName !== shortTypeName &&
            (waterLevel < 16 || surround.backward.effectiveWaterLevel < 16))
        ) {
          blockOpacityCode += 32;
        }

        if (nextWaterLevel >= 16) {
          waterCode += 32;
        }

        // if we're surrounded by other blocks, return empty to indicate nothing should be rendered.
        if (blockOpacityCode >= 63) {
          return "";
        }

        base += String.fromCharCode(48 + blockOpacityCode);

        base += String.fromCharCode(48 + waterCode);
      }
    }

    return base;
  }

  createWaterMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    let level = 1 - block.effectiveWaterLevel / Block.MAX_WATER_LEVEL;

    if (level === 0) {
      level = 0.02;
    }

    const waterMaterial = new BABYLON.StandardMaterial("water", this._scene);
    waterMaterial.alpha = 0.6;
    waterMaterial.diffuseColor = new BABYLON.Color3(0.02, 0.02, 1);

    const sourceMesh = this._createBlockMesh(name, block, waterMaterial, 1, level, 1);

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

    const blockType = block.bedrockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const material = blockType.getIcon();

    const stairMaterial = this._ensureMaterial(material);

    sourceMeshLower.material = stairMaterial;
    sourceMeshUpper.material = stairMaterial;

    const dir = block.getPropertyNumber("weirdo_direction", 2);

    if (dir === 0) {
      sourceMesh.rotation.y = Math.PI;
    }

    return sourceMesh;
  }

  createButtonMesh(name: string, block: Block): BABYLON.Mesh {
    const sourceMesh = new BABYLON.Mesh(name, this._scene); //this.createBoundingMesh(name);
    this._applyMeshSettings(sourceMesh);

    const buttonMesh = BABYLON.MeshBuilder.CreateBox(name + "|u", this._createBoxOptions(0.2, 0.1, 0.2));
    buttonMesh.position.y = 0 - 0.45;
    sourceMesh.addChild(buttonMesh);

    const blockType = block.bedrockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const material = blockType.getIcon();

    const buttonMaterial = this._ensureMaterial(material);

    buttonMesh.material = buttonMaterial;

    return sourceMesh;
  }

  createDoorMesh(name: string, block: Block): BABYLON.Mesh {
    const blockType = block.bedrockType;

    if (blockType === undefined) {
      return this.createErrorMesh(name);
    }

    const isUpper = block.getPropertyBoolean("upper_block_bit", false);

    const sourceMesh = BABYLON.MeshBuilder.CreateBox(name, this._createBoxOptions(1, 1, 0.13), this._scene);

    const doorMaterial = this._ensureMaterial("door_" + blockType.material + "_" + (isUpper ? "upper" : "lower"));

    sourceMesh.material = doorMaterial;

    return sourceMesh;
  }

  createGrassMesh(name: string, block: Block): BABYLON.Mesh {
    const faceUV = new Array(6);

    faceUV[0] = new BABYLON.Vector4(0.75, 0, 1, 0.5);
    faceUV[1] = new BABYLON.Vector4(0.75, 0, 1, 0.5);
    faceUV[2] = new BABYLON.Vector4(0.75, 0, 1, 0.5);
    faceUV[3] = new BABYLON.Vector4(0.75, 0, 1, 0.5);
    faceUV[4] = new BABYLON.Vector4(0.25, 0, 0.5, 0.5);
    faceUV[5] = new BABYLON.Vector4(0, 0, 0.25, 0.5);

    const grassMaterial = this._ensureMaterial("grass_side_carried");

    const sourceMesh = this._createBlockPlaneMesh(name, block, grassMaterial, false, faceUV, [
      "grass_side_carried",
      "grass_side_carried",
      "grass_side_carried",
      "grass_side_carried",
      "grass_carried",
      "dirt",
    ]);

    if (sourceMesh === undefined) {
      throw new Error("Undefined grass mesh");
    }

    return sourceMesh;
  }

  createLogMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    const faceUV = new Array(6);

    faceUV[0] = new BABYLON.Vector4(0, 0, 0.5, 1);
    faceUV[1] = new BABYLON.Vector4(0, 0, 0.5, 1);
    faceUV[2] = new BABYLON.Vector4(0, 0, 0.5, 1);
    faceUV[3] = new BABYLON.Vector4(0, 0, 0.5, 1);
    faceUV[4] = new BABYLON.Vector4(0.5, 0, 1, 1);
    faceUV[5] = new BABYLON.Vector4(0.5, 0, 1, 1);

    const material = block.getPropertyString("old_log_type", "oak");

    const logMaterial = this._ensureMaterial("log_" + material + "_f");

    const sourceMesh = this._createBlockMesh(name, block, logMaterial, 1, 1, 1, faceUV);

    return sourceMesh;
  }

  createLeavesMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    const faceUV = new Array(6);

    for (let i = 0; i < 6; i++) {
      faceUV[i] = new BABYLON.Vector4(0, 0, 1, 1);
    }

    const material = block.getPropertyString("old_log_type", "acacia");

    const leavesMaterial = this._ensureMaterial("leaves_" + material + "_carried");

    const sourceMesh = this._createBlockMesh(name, block, leavesMaterial, 1, 1, 1, faceUV);

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

    const material = "tallgrass_carried";

    const grassMaterial = this._ensureMaterialRegularSideUp(material);

    sourceMesh.material = grassMaterial;

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

    const sourceMeshB = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);
    sourceMesh.rotation.y = -(Math.PI / 4); // 45 degrees

    sourceMesh.addChild(sourceMeshB);

    const material = "dandelion";

    const flowerMaterial = this._ensureMaterial("flower_" + material);

    sourceMesh.material = flowerMaterial;
    sourceMeshB.material = flowerMaterial;

    return sourceMesh;
  }

  createBillboardMesh(name: string, block: Block): BABYLON.Mesh {
    const options = {
      size: 1,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      frontUVs: new BABYLON.Vector4(0, 0, 1, 1),
      backUVs: new BABYLON.Vector4(0, 0, 1, 1),
    };

    const sourceMesh = BABYLON.MeshBuilder.CreatePlane(name, options, this._scene);
    sourceMesh.rotation.y = Math.PI / 4; // 45 degrees

    let materialName = block.shortTypeName;

    const blockType = block.bedrockType;

    if (blockType !== undefined) {
      materialName = blockType.getIcon();
    }

    if (materialName !== undefined) {
      const material = this._ensureMaterial(materialName);

      sourceMesh.material = material;
    }

    return sourceMesh;
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

    const material = this._ensureMaterial("redstone_dust_line");

    wireMesh.material = material;

    return sourceMesh;
  }

  createRailMesh(name: string, block: Block): BABYLON.Mesh | undefined {
    if (block.shortTypeName === undefined) {
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

    let materialName = block.shortTypeName;

    const blockType = block.bedrockType;

    if (blockType !== undefined) {
      materialName = blockType.getIcon();
    }

    const material = this._ensureMaterial(materialName);

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

    const logMaterial = this._ensureMaterial("grass_path_f");

    sourceMesh.material = logMaterial;

    return sourceMesh;
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
    let sourceMesh: BABYLON.Mesh | undefined = undefined;

    if (this._scene === undefined || this._scene === null || block.bedrockType === undefined) {
      return this.createErrorMesh(name);
    }

    const baseType = block.bedrockType.baseType.name;
    //acacia_leaves
    if (baseType === "water") {
      sourceMesh = this.createWaterMesh(name, block);
    } else if (baseType === "stairs") {
      sourceMesh = this.createStairsMesh(name, block);

      this._applyWaterLogging(block, sourceMesh);
    } else if (baseType === "button") {
      sourceMesh = this.createButtonMesh(name, block);

      this._applyWaterLogging(block, sourceMesh);
    } else if (baseType === "grass") {
      sourceMesh = this.createGrassMesh(name, block);
    } else if (baseType === "leaves" || baseType === "leaves2") {
      sourceMesh = this.createLeavesMesh(name, block);
    } else if (baseType === "door") {
      sourceMesh = this.createDoorMesh(name, block);

      this._applyWaterLogging(block, sourceMesh);
    } else if (baseType === "log" || baseType === "log2") {
      sourceMesh = this.createLogMesh(name, block);
    } else if (baseType === "grass_path") {
      sourceMesh = this.createGrassPathMesh(name, block);
    } else if (baseType === "redstone_wire") {
      sourceMesh = this.createRedstoneWireMesh(name, block);
    } else if (baseType === "rail") {
      sourceMesh = this.createRailMesh(name, block);
    } else if (baseType === "tallgrass") {
      sourceMesh = this.createTallGrassMesh(name, block);
    } else if (baseType === "flower") {
      sourceMesh = this.createFlowerMesh(name, block);

      this._applyWaterLogging(block, sourceMesh);
    } else if (baseType === "wood") {
      sourceMesh = this.createWoodMesh(name, block);

      if (sourceMesh !== undefined) {
        this._applyWaterLogging(block, sourceMesh);
      }
    } else if (baseType === "planks") {
      sourceMesh = this.createPlankMesh(name, block);

      if (sourceMesh !== undefined) {
        this._applyWaterLogging(block, sourceMesh);
      }
    } else {
      sourceMesh = this.createSimpleBlockMesh(name, block);
    }

    return sourceMesh;
  }

  createErrorMesh(name: string) {
    const sourceMesh = BABYLON.MeshBuilder.CreateBox(name, this._createBoxOptions(1, 1, 1), this._scene);
    sourceMesh.material = this._ensureMaterial("barrier");

    return sourceMesh;
  }

  createWoodMesh(name: string, block: Block) {
    if (block.shortTypeName === undefined) {
      return undefined;
    }

    let materialName = block.shortTypeName;

    const blockType = block.bedrockType;

    if (materialName === "wood") {
      const woodMaterialProperties = block.properties["wood_type"];

      if (woodMaterialProperties !== undefined) {
        materialName = "log_" + woodMaterialProperties.value;
      }
    } else {
      if (blockType !== undefined) {
        materialName = blockType.getIcon();
      }
    }

    const material = this._ensureMaterial(materialName);

    return this._createBlockMesh(name, block, material, 1, 1, 1);
  }

  createPlankMesh(name: string, block: Block) {
    if (block.shortTypeName === undefined) {
      return undefined;
    }

    let materialName = block.shortTypeName;

    const blockType = block.bedrockType;

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

    const material = this._ensureMaterial(materialName);

    return this._createBlockMesh(name, block, material, 1, 1, 1);
  }

  createSimpleBlockMesh(name: string, block: Block) {
    if (block.shortTypeName === undefined) {
      return undefined;
    }

    let materialName = block.shortTypeName;

    const blockType = block.bedrockType;

    if (blockType !== undefined) {
      materialName = blockType.getIcon();
    }

    const material = this._ensureMaterial(materialName);

    return this._createBlockMesh(name, block, material, 1, 1, 1);
  }

  _createBlockMesh(
    name: string,
    block: Block,
    material: BABYLON.Material,
    xExtent: number,
    yExtent: number,
    zExtent: number,
    meshFaceUV?: BABYLON.Vector4[] | undefined
  ) {
    let singleUV = false;

    if (meshFaceUV === undefined) {
      singleUV = true;
      meshFaceUV = new Array(6);

      for (let i = 0; i < 6; i++) {
        if (i === 4 || i === 5) {
          meshFaceUV[i] = new BABYLON.Vector4(0, 0, zExtent, 1);
        } else {
          meshFaceUV[i] = new BABYLON.Vector4(0, 0, 1, 1);
        }
      }
    }

    if (block.opaqueSideCount === 0) {
      return undefined;
    } else if (!singleUV && block.opaqueSideCount < 4) {
      const sourceMesh = BABYLON.MeshBuilder.CreateBox(
        name,
        this._createBoxOptions(xExtent, yExtent, zExtent, meshFaceUV),
        this._scene
      );

      if (block.shortTypeName !== undefined) {
        sourceMesh.material = material;
      }

      this._applyMeshSettings(sourceMesh);

      return sourceMesh;
    }

    return this._createBlockPlaneMesh(name, block, material, singleUV, meshFaceUV, undefined);
  }

  _createBlockPlaneMesh(
    name: string,
    block: Block,
    material: BABYLON.Material,
    singleUV: boolean,
    meshFaceUV: BABYLON.Vector4[],
    sideNames?: string[]
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

    const shortTypeName = block.shortTypeName;
    const waterLevel = block.effectiveWaterLevel;

    if (
      surround.backward === undefined ||
      surround.backward.isEmpty ||
      (!surround.backward.isOpaque &&
        surround.backward.shortTypeName !== shortTypeName &&
        (waterLevel < 16 || surround.backward.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matToApply = material;

      if (sideNames !== undefined) {
        matToApply = this._ensureMaterial(sideNames[0]);
      } else if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: meshFaceUV[0],
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|b", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);
      planeMesh.position.z = -0.5;
    }

    if (
      surround.forward === undefined ||
      surround.forward.isEmpty ||
      (!surround.forward.isOpaque &&
        surround.forward.shortTypeName !== shortTypeName &&
        (waterLevel < 16 || surround.forward.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      const matToApply = material;

      if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: meshFaceUV[1],
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|f", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);

      parentMesh.addChild(planeMesh);
      planeMesh.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI, BABYLON.Space.WORLD);
      planeMesh.position.z = 0.5;
    }

    if (
      surround.left === undefined ||
      surround.left.isEmpty ||
      (!surround.left.isOpaque &&
        surround.left.shortTypeName !== shortTypeName &&
        (waterLevel < 16 || surround.left.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matToApply = material;

      if (sideNames !== undefined) {
        matToApply = this._ensureMaterial(sideNames[2]);
      } else if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: meshFaceUV[2],
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|l", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.x = +0.5;
      planeMesh.rotation.y = -(Math.PI / 2);
    }

    if (
      surround.right === undefined ||
      surround.right.isEmpty ||
      (!surround.right.isOpaque &&
        surround.right.shortTypeName !== shortTypeName &&
        (waterLevel < 16 || surround.right.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matToApply = material;

      if (sideNames !== undefined) {
        matToApply = this._ensureMaterial(sideNames[3]);
      } else if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: meshFaceUV[3],
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|r", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.x = -0.5;
      planeMesh.rotation.y = Math.PI / 2;
    }

    if (
      surround.up === undefined ||
      surround.up.isEmpty ||
      (!surround.up.isOpaque &&
        surround.up.shortTypeName !== shortTypeName &&
        (waterLevel < 16 || surround.up.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matToApply = material;

      if (sideNames !== undefined) {
        matToApply = this._ensureMaterial(sideNames[4]);
      } else if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: meshFaceUV[4],
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|u", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.y = 0.5;
      planeMesh.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2, BABYLON.Space.WORLD);
    }

    if (
      surround.down === undefined ||
      surround.down.isEmpty ||
      (!surround.down.isOpaque &&
        surround.down.shortTypeName !== shortTypeName &&
        (waterLevel < 16 || surround.down.effectiveWaterLevel < 16))
    ) {
      let options = defaultOptions;
      let matToApply = material;

      if (sideNames !== undefined) {
        matToApply = this._ensureMaterial(sideNames[5]);
      } else if (!singleUV) {
        options = {
          size: 1,
          sideOrientation: BABYLON.Mesh.DOUBLESIDE,
          frontUVs: meshFaceUV[5],
        };
      }

      const planeMesh = BABYLON.MeshBuilder.CreatePlane(name + "|d", options, this._scene);
      planeMesh.material = matToApply;
      this._applyMeshSettings(planeMesh);
      parentMesh.addChild(planeMesh);

      planeMesh.position.y = -0.5;
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

  _ensureMaterial(name: string) {
    let mat = this._materials[name];

    if (mat == null && this._scene != null) {
      mat = new BABYLON.StandardMaterial("mat." + name, this._scene);
      mat.alpha = 1.0;

      const texture = new BABYLON.Texture(
        CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/" + name + ".png",
        this._scene,
        true,
        false,
        8
      );
      texture.anisotropicFilteringLevel = 10;
      texture.hasAlpha = true;
      texture.uScale = 1;
      texture.vScale = -1;

      mat.diffuseTexture = texture;
      mat.backFaceCulling = true;
      // mat.opacityTexture = texture;

      this._materials[name] = mat;
      mat.freeze();
    }

    return mat;
  }

  _ensureMaterialRegularSideUp(name: string) {
    let mat = this._materials[name];

    if (mat == null && this._scene != null) {
      mat = new BABYLON.StandardMaterial("mat." + name, this._scene);
      mat.alpha = 1.0;

      const texture = new BABYLON.Texture(
        CartoApp.contentRoot + "res/latest/van/resource_pack/textures/blocks/" + name + ".png",
        this._scene,
        true,
        false,
        8
      );
      texture.anisotropicFilteringLevel = 10;
      texture.hasAlpha = true;

      mat.diffuseTexture = texture;
      mat.backFaceCulling = true;
      // mat.opacityTexture = texture;

      this._materials[name] = mat;
      mat.freeze();
    }

    return mat;
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
