/*
 * ==========================================================================================
 * MODEL MESH FACTORY ARCHITECTURE NOTES
 * ==========================================================================================
 *
 * OVERVIEW:
 * ---------
 * Creates 3D Babylon.js meshes from Minecraft entity geometry definitions (.geo.json).
 * Used by MobViewer, ModelViewer, and VolumeEditor for rendering entities.
 *
 * Last Updated: December 2025
 *
 * COORDINATE SYSTEMS:
 * -------------------
 * Minecraft Bedrock Edition:
 *   - Right-handed coordinate system
 *   - +Y is up, +Z is forward (towards the viewer in default orientation), +X is right
 *   - Units are in 1/16ths of a block (so divide by 16 for block units)
 *
 * Babylon.js:
 *   - Left-handed coordinate system
 *   - +Y is up, +Z is forward (into the screen), +X is right
 *
 * Conversion Rules:
 *   - X: same (no change needed)
 *   - Y: same (no change needed)
 *   - Z: **negate** (Minecraft +Z → Babylon -Z)
 *
 * GEOMETRY STRUCTURE (IGeometry):
 * -------------------------------
 * Bones have:
 *   - name: Identifier for the bone
 *   - pivot: [x, y, z] - The rotation/animation pivot point in world coordinates
 *   - parent: Name of parent bone (optional, root bones have no parent)
 *   - bind_pose_rotation: [x, y, z] degrees - rotation applied to the bone's default pose
 *   - rotation: [x, y, z] degrees - Additional rotation (used in animation)
 *   - cubes: Array of cube definitions attached to this bone
 *
 * Cubes have:
 *   - origin: [x, y, z] - The **minimum corner** of the cube in world coordinates
 *   - size: [width, height, depth] - Dimensions of the cube
 *   - pivot/rotation: Optional per-cube rotation
 *   - inflate: Uniform expansion (commonly used for outer layer like hat on player)
 *   - uv: Either [u, v] for box UV mapping or object with per-face UVs
 *
 * KEY INSIGHT: Cube origin is the MINIMUM corner (not center).
 * Cube center = origin + size/2. Cubes are defined in WORLD coordinates.
 *
 * BIND_POSE_ROTATION HANDLING:
 * ----------------------------
 * bind_pose_rotation defines the default rotation of a bone in its rest pose before
 * animation. This is used extensively for quadruped animals (cow, pig, sheep) where
 * the body bone has bind_pose_rotation: [90, 0, 0].
 *
 * Solution for Converting bind_pose_rotation to Babylon.js:
 * 1. Create a TransformNode at the bone's pivot (converting Z: negate for Babylon)
 * 2. Apply rotation with **negated X and Y**, positive Z:
 *    rotNode.rotation = new BABYLON.Vector3(
 *      BABYLON.Tools.ToRadians(-rot[0]),  // Negate X
 *      BABYLON.Tools.ToRadians(-rot[1]),  // Negate Y
 *      BABYLON.Tools.ToRadians(rot[2])    // Keep Z positive
 *    );
 * 3. Position child cubes relative to the pivot WITHOUT negating Z (the rotation
 *    node handles coordinate conversion):
 *    mesh.position = new BABYLON.Vector3(
 *      (cubeCenterX - pivotX) / 16,
 *      (cubeCenterY - pivotY) / 16,
 *      (cubeCenterZ - pivotZ) / 16  // Don't negate Z here
 *    );
 *
 * PER-CUBE ROTATION (different from bind_pose_rotation):
 * - bind_pose_rotation: negate BOTH X and Y
 * - per-cube rotation: keep X positive, negate Y only
 *
 * KNOWN WORKING MODELS (no bind_pose_rotation):
 * - Zombie, Skeleton, and humanoid models render correctly without special handling
 *
 * KNOWN MODELS REQUIRING TRANSFORMS (have bind_pose_rotation):
 * - Cow, Pig, Sheep: body has bind_pose_rotation: [90, 0, 0]
 * - See VanillaGeometryTransforms.ts for model-specific corrections
 *
 * CRITICAL TEXTURE SETTINGS (ensureMaterial):
 * -------------------------------------------
 * texture = new BABYLON.Texture(dataUrl, scene, true, true, NEAREST_SAMPLINGMODE)
 *                                               ↑    ↑
 *                                         noMipmap  invertY
 *
 * - invertY MUST remain true - Critical for correct texture orientation
 * - noMipmap = true for pixel art
 *
 * DO NOT ADD these material settings (causes ghostly/transparent appearance):
 * - mat.useAlphaFromDiffuseTexture = true  ← WRONG
 * - mat.alphaMode = 1                       ← WRONG
 *
 * UV COORDINATE MAPPING (_uvToVector4):
 * -------------------------------------
 * With invertY=true, V coordinates need to be flipped:
 *   const vMin = 1 - (v + height) / texHeight;
 *   const vMax = 1 - v / texHeight;
 *
 * VANILLA GEOMETRY TRANSFORMS (VanillaGeometryTransforms.ts):
 * -----------------------------------------------------------
 * Some vanilla models need corrections for hardcoded Minecraft rendering quirks.
 * Transforms are applied before mesh creation via applyGeometryTransforms().
 *
 * KNOWN LIMITATIONS:
 * ------------------
 * 1. Dynamic shader coloring (sheep wool, tropical fish patterns) - renders raw texture
 * 2. Some models may appear smaller/floating - camera positioning may need per-entity tuning
 * 3. Variant geometries (e.g., pig.saddle) may not render all parts
 *
 * KEY METHODS:
 * ------------
 * - createMesh(): Entry point, creates parent mesh, iterates bones, creates cube meshes
 * - _getAccumulatedBoneTransform(): Combined pivot/rotation including parent transforms
 * - _rotatePointAroundPivot(): Rotates point around pivot (X, then Y, then Z order)
 * - _createCubeMesh(): Creates Babylon.js box for a cube with proper UV mapping
 * - _calculateFaceUVs(): Maps Minecraft UV to Babylon.js face UVs
 *
 * DEBUGGING TIPS:
 * ---------------
 * - Textures upside down: Check _uvToVector4 V coordinate calculation
 * - Ghostly/transparent: Remove alpha settings from material
 * - Completely white: Check texture loading (console logs, verify URL/data)
 * - Parts floating: Check parent bone rotation chaining
 * - Model rotated 90°: Body bone has bind_pose_rotation not being applied
 * - Cow laying flat: bind_pose_rotation [90,0,0] not processed; check BoneTransform map
 * - Parts scattered wrong: Check rotation sign convention (negate X and Y)
 *
 * TESTING:
 * --------
 * npx playwright test MobViewer.spec.ts --project=chromium
 * npx playwright test MobViewer.spec.ts --project=chromium --update-snapshots
 *
 * ==========================================================================================
 */

import CreatorToolsHost from "../../app/CreatorToolsHost";
import * as BABYLON from "babylonjs";
import Log from "../../core/Log";
import IBlockVolumeBounds from "../../minecraft/IBlockVolumeBounds";
import {
  IGeometry,
  IGeometryBoneCube,
  IGeometryUVFaces,
  IGeometryUVFace,
  IGeometryPolyMesh,
  IGeometryBoneTextureMesh,
} from "../../minecraft/IModelGeometry";
import { applyGeometryTransforms } from "../../minecraft/VanillaGeometryTransforms";
import ImageCodec from "../../core/ImageCodec";

// Bone transform data for applying bind_pose_rotation
interface BoneTransform {
  pivot: number[];
  rotation: number[]; // bind_pose_rotation in degrees [x, y, z]
  parentName?: string;
}

export class ModelMeshFactory {
  _scene: BABYLON.Scene;
  _bounds: IBlockVolumeBounds | undefined;

  _materials: Map<string, BABYLON.StandardMaterial> = new Map();

  constructor(scene: BABYLON.Scene, bounds?: IBlockVolumeBounds) {
    this._scene = scene;
    this._bounds = bounds;
  }

  createMesh(
    name: string,
    model: IGeometry,
    textureName: string,
    textureData?: Uint8Array,
    textureUrl?: string,
    geometryId?: string
  ): BABYLON.Mesh | undefined {
    const parentMesh = new BABYLON.Mesh(name, this._scene);
    this._applyMeshSettings(parentMesh);

    // Debug: Log incoming model structure
    const boneCount = model.bones?.length || 0;
    let totalCubes = 0;
    if (model.bones) {
      for (const bone of model.bones) {
        totalCubes += bone.cubes?.length || 0;
      }
    }
    // Only log for complex models to reduce console noise
    if (totalCubes > 20) {
      Log.verbose(
        `[ModelMeshFactory.createMesh] name=${name}, bones=${boneCount}, totalCubes=${totalCubes}, identifier=${model.description?.identifier}`
      );
    }

    // Apply vanilla geometry transforms if applicable
    // This handles models that need corrections for hardcoded Minecraft rendering quirks
    // The geometryId can be explicitly passed (useful for v1 format) or extracted from description
    const effectiveGeometryId = geometryId || model.description?.identifier || "";
    const transformedModel = applyGeometryTransforms(model, effectiveGeometryId);

    // Get texture dimensions from model
    const texWidth = transformedModel.description?.texture_width || transformedModel.texturewidth || 64;
    const texHeight = transformedModel.description?.texture_height || transformedModel.textureheight || 64;

    const mat = this.ensureMaterial(textureName, textureData, textureUrl, texWidth, texHeight);

    // Build bone transform map for handling bind_pose_rotation
    const boneTransforms: Map<string, BoneTransform> = new Map();
    // Map of bone name to Babylon TransformNode for proper scene graph hierarchy
    const boneNodes: Map<string, BABYLON.TransformNode> = new Map();

    if (transformedModel.bones) {
      // First pass: create BoneTransform data and TransformNodes for all bones
      for (const bone of transformedModel.bones) {
        boneTransforms.set(bone.name, {
          pivot: bone.pivot || [0, 0, 0],
          rotation: bone.bind_pose_rotation || [0, 0, 0],
          parentName: bone.parent,
        });

        // Create a TransformNode for this bone at its pivot point
        const boneNode = new BABYLON.TransformNode(name + "_bone_" + bone.name, this._scene);
        const pivot = bone.pivot || [0, 0, 0];

        // Set position at bone pivot (converting to Babylon coords - negate Z)
        boneNode.position = new BABYLON.Vector3(pivot[0] / 16, pivot[1] / 16, -pivot[2] / 16);

        // Apply bind_pose_rotation if present
        if (bone.bind_pose_rotation) {
          const rot = bone.bind_pose_rotation;
          // Negate X and Y rotations when converting coordinate systems
          boneNode.rotation = new BABYLON.Vector3(
            BABYLON.Tools.ToRadians(-rot[0]),
            BABYLON.Tools.ToRadians(-rot[1]),
            BABYLON.Tools.ToRadians(rot[2])
          );
        }

        boneNodes.set(bone.name, boneNode);
      }

      // Second pass: set up parent-child relationships between bone nodes
      for (const bone of transformedModel.bones) {
        const boneNode = boneNodes.get(bone.name);
        if (!boneNode) continue;

        if (bone.parent) {
          const parentNode = boneNodes.get(bone.parent);
          if (parentNode) {
            // Child bones need their position adjusted relative to parent
            const parentPivot = boneTransforms.get(bone.parent)?.pivot || [0, 0, 0];
            const bonePivot = bone.pivot || [0, 0, 0];

            // Position is relative to parent's pivot in parent's local space
            boneNode.position = new BABYLON.Vector3(
              (bonePivot[0] - parentPivot[0]) / 16,
              (bonePivot[1] - parentPivot[1]) / 16,
              -(bonePivot[2] - parentPivot[2]) / 16
            );

            boneNode.parent = parentNode;
          } else {
            // Parent not found, attach to root
            boneNode.parent = parentMesh;
          }
        } else {
          // Root bone - attach to parent mesh
          boneNode.parent = parentMesh;
        }
      }

      // Third pass: create cube meshes
      // Use a single bone hierarchy with one TransformNode per bone that has rotation
      // This properly applies rotation to all cubes belonging to a bone and its children

      // Walk up the bone hierarchy to find the nearest ancestor with bind_pose_rotation.
      // Child bone cubes are positioned relative to the rotated parent, so they need
      // the parent's rotation applied. Entities where child bones should NOT inherit
      // parent rotation (e.g., sheep legs are in world space) use VanillaGeometryTransforms
      // to detach those bones (removeParent) before this code runs.
      const getAccumulatedRotation = (boneName: string): { pivot: number[]; rotation: number[] } | null => {
        let current = boneTransforms.get(boneName);
        while (current) {
          if (current.rotation[0] !== 0 || current.rotation[1] !== 0 || current.rotation[2] !== 0) {
            return { pivot: current.pivot, rotation: current.rotation };
          }
          if (current.parentName) {
            current = boneTransforms.get(current.parentName);
          } else {
            break;
          }
        }
        return null;
      };

      // Create rotation TransformNodes for bones with bind_pose_rotation
      // These will be positioned at the bone's pivot and rotated
      const rotationNodes: Map<string, BABYLON.TransformNode> = new Map();
      for (const bone of transformedModel.bones) {
        if (
          bone.bind_pose_rotation &&
          (bone.bind_pose_rotation[0] !== 0 || bone.bind_pose_rotation[1] !== 0 || bone.bind_pose_rotation[2] !== 0)
        ) {
          const pivot = bone.pivot || [0, 0, 0];
          const rotNode = new BABYLON.TransformNode(name + "_rotpivot_" + bone.name, this._scene);

          // Position at pivot in Babylon coords
          rotNode.position = new BABYLON.Vector3(pivot[0] / 16, pivot[1] / 16, -pivot[2] / 16);

          // Apply rotation - try negative X to fix upside-down cow
          const rot = bone.bind_pose_rotation;
          rotNode.rotation = new BABYLON.Vector3(
            BABYLON.Tools.ToRadians(-rot[0]), // Negate X rotation
            BABYLON.Tools.ToRadians(-rot[1]),
            BABYLON.Tools.ToRadians(rot[2])
          );

          rotNode.parent = parentMesh;
          rotationNodes.set(bone.name, rotNode);
        }
      }

      for (const bone of transformedModel.bones) {
        if (bone.cubes && bone.cubes.length > 0) {
          // Find the effective rotation (from this bone or any ancestor)
          const effectiveTransform = getAccumulatedRotation(bone.name);

          for (let cubeIndex = 0; cubeIndex < bone.cubes.length; cubeIndex++) {
            const cube = bone.cubes[cubeIndex];

            // Create cube mesh
            const origin = cube.origin;
            const size = cube.size;
            const inflate = cube.inflate || 0;

            const actualWidth = (size[0] + inflate * 2) / 16;
            const actualHeight = (size[1] + inflate * 2) / 16;
            const actualDepth = (size[2] + inflate * 2) / 16;

            const isPlaneX = size[0] === 0;
            const isPlaneY = size[1] === 0;
            const isPlaneZ = size[2] === 0;
            const isPlane = isPlaneX || isPlaneY || isPlaneZ;

            let mesh: BABYLON.Mesh;

            if (isPlane) {
              mesh = this._createPlaneMesh(
                name + "_bone_" + bone.name + "_cube_" + cubeIndex,
                cube,
                size,
                texWidth,
                texHeight,
                mat,
                isPlaneX,
                isPlaneY,
                isPlaneZ
              );
            } else {
              const faceUVs = this._calculateFaceUVs(cube, size, texWidth, texHeight);
              const options = {
                width: actualWidth,
                height: actualHeight,
                depth: actualDepth,
                faceUV: faceUVs,
                wrap: true,
              };
              mesh = BABYLON.MeshBuilder.CreateBox(
                name + "_bone_" + bone.name + "_cube_" + cubeIndex,
                options,
                this._scene
              );
              mesh.material = mat;
            }

            // Cube center in Minecraft world coordinates
            const cubeCenterX = origin[0] + size[0] / 2;
            const cubeCenterY = origin[1] + size[1] / 2;
            const cubeCenterZ = origin[2] + size[2] / 2;

            // Handle per-cube rotation (used in v2 geometry format)
            // This is different from bind_pose_rotation which is on bones
            if (cube.rotation && (cube.rotation[0] !== 0 || cube.rotation[1] !== 0 || cube.rotation[2] !== 0)) {
              // Cube has its own rotation - create a rotation node at the cube's pivot
              const cubePivot = cube.pivot || [cubeCenterX, cubeCenterY, cubeCenterZ];

              const cubeRotNode = new BABYLON.TransformNode(
                name + "_bone_" + bone.name + "_cube_" + cubeIndex + "_rot",
                this._scene
              );

              // Position at cube pivot in world coords
              // NOTE: Minecraft geometry cube origins and pivots are in world/model coordinates,
              // not relative to bone hierarchy. The bone hierarchy is only used for animations.
              cubeRotNode.position = new BABYLON.Vector3(
                cubePivot[0] / 16,
                cubePivot[1] / 16,
                -cubePivot[2] / 16 // Negate Z for Babylon
              );

              // Apply cube rotation
              // Per-cube rotation uses different sign convention than bind_pose_rotation:
              // - X (pitch): keep positive (per original v0.33.2 working code)
              // - Y (yaw): negate for Z-axis flip
              // - Z (roll): keep positive
              cubeRotNode.rotation = new BABYLON.Vector3(
                BABYLON.Tools.ToRadians(cube.rotation[0]), // X: keep positive (pitch)
                BABYLON.Tools.ToRadians(-cube.rotation[1]), // Y: negate for Z flip (yaw)
                BABYLON.Tools.ToRadians(cube.rotation[2]) // Z: keep positive (roll)
              );

              cubeRotNode.parent = parentMesh;

              // Position mesh relative to the cube's rotation pivot
              // Negate Z offset for coordinate system conversion (per original v0.33.2 working code)
              mesh.position = new BABYLON.Vector3(
                (cubeCenterX - cubePivot[0]) / 16,
                (cubeCenterY - cubePivot[1]) / 16,
                -(cubeCenterZ - cubePivot[2]) / 16 // Negate Z offset
              );

              mesh.parent = cubeRotNode;
            } else if (effectiveTransform) {
              // Find the rotation node for this bone's effective transform
              // We need to find which bone has the rotation
              let rotatingBoneName: string | undefined;
              let current = boneTransforms.get(bone.name);
              while (current) {
                if (current.rotation[0] !== 0 || current.rotation[1] !== 0 || current.rotation[2] !== 0) {
                  // Find the bone name for this transform
                  for (const [name, transform] of boneTransforms.entries()) {
                    if (transform === current) {
                      rotatingBoneName = name;
                      break;
                    }
                  }
                  break;
                }
                if (current.parentName) {
                  current = boneTransforms.get(current.parentName);
                } else {
                  break;
                }
              }

              const rotNode = rotatingBoneName ? rotationNodes.get(rotatingBoneName) : undefined;

              if (rotNode) {
                // Position cube relative to the rotation pivot (which is at the bone's pivot)
                const pivotX = effectiveTransform.pivot[0];
                const pivotY = effectiveTransform.pivot[1];
                const pivotZ = effectiveTransform.pivot[2];

                // Cube position relative to pivot in the rotation node's local space
                // Since the rotation node handles the coord transform, use Minecraft coords directly
                mesh.position = new BABYLON.Vector3(
                  (cubeCenterX - pivotX) / 16,
                  (cubeCenterY - pivotY) / 16,
                  (cubeCenterZ - pivotZ) / 16 // Don't negate Z - rotation node handles it
                );

                mesh.parent = rotNode;
              } else {
                // No rotation node found - fall back to world position
                mesh.position = new BABYLON.Vector3(cubeCenterX / 16, cubeCenterY / 16, -cubeCenterZ / 16);
                mesh.parent = parentMesh;
              }
            } else {
              // No rotation in hierarchy - just position at world coords
              // NOTE: Minecraft geometry cube origins are in world/model coordinates,
              // not relative to bone hierarchy. The bone hierarchy is only used for animations.
              mesh.position = new BABYLON.Vector3(
                cubeCenterX / 16,
                cubeCenterY / 16,
                -cubeCenterZ / 16 // Negate Z for Babylon
              );
              mesh.parent = parentMesh;
            }

            this._applyMeshSettings(mesh);
          }
        }

        // Handle poly_mesh if present
        if (bone.poly_mesh) {
          const polyMesh = this._createPolyMesh(
            name + "_bone_" + bone.name + "_polymesh",
            bone.poly_mesh,
            [0, 0, 0],
            texWidth,
            texHeight,
            mat
          );

          if (polyMesh) {
            polyMesh.parent = parentMesh;
          }
        }

        // Handle texture_meshes if present (used by items like bow, crossbow)
        // A texture_mesh renders the full texture as a flat sprite plane.
        if (bone.texture_meshes && bone.texture_meshes.length > 0) {
          for (let tmIndex = 0; tmIndex < bone.texture_meshes.length; tmIndex++) {
            const texMesh = bone.texture_meshes[tmIndex];
            const tmName = name + "_bone_" + bone.name + "_texmesh_" + tmIndex;

            const spriteMesh = this._createTextureMeshSprite(tmName, texMesh, texWidth, texHeight, mat);

            if (spriteMesh) {
              spriteMesh.parent = parentMesh;
            }
          }
        }
      }
    }

    return parentMesh;
  }

  /**
   * Create a cube mesh positioned relative to a bone's pivot.
   * The cube will be attached to the bone's TransformNode, so it inherits
   * the bone's rotation and position (and any parent bone transforms).
   */
  _createCubeMeshForBone(
    name: string,
    cube: IGeometryBoneCube,
    bonePivot: number[],
    texWidth: number,
    texHeight: number,
    material: BABYLON.StandardMaterial
  ): BABYLON.Mesh | undefined {
    const origin = cube.origin;
    const size = cube.size;
    const inflate = cube.inflate || 0;

    // Calculate actual size with inflation
    const actualWidth = (size[0] + inflate * 2) / 16;
    const actualHeight = (size[1] + inflate * 2) / 16;
    const actualDepth = (size[2] + inflate * 2) / 16;

    // Check if this is a flat plane (one dimension is 0)
    const isPlaneX = size[0] === 0;
    const isPlaneY = size[1] === 0;
    const isPlaneZ = size[2] === 0;
    const isPlane = isPlaneX || isPlaneY || isPlaneZ;

    let mesh: BABYLON.Mesh;

    if (isPlane) {
      mesh = this._createPlaneMesh(name, cube, size, texWidth, texHeight, material, isPlaneX, isPlaneY, isPlaneZ);
    } else {
      const faceUVs = this._calculateFaceUVs(cube, size, texWidth, texHeight);
      const options = {
        width: actualWidth,
        height: actualHeight,
        depth: actualDepth,
        faceUV: faceUVs,
        wrap: true,
      };
      mesh = BABYLON.MeshBuilder.CreateBox(name, options, this._scene);
      mesh.material = material;
    }

    // Cube center in Minecraft coordinates (origin is min corner)
    const cubeCenterX = origin[0] + size[0] / 2;
    const cubeCenterY = origin[1] + size[1] / 2;
    const cubeCenterZ = origin[2] + size[2] / 2;

    // Handle cube's own rotation if present
    if (cube.rotation) {
      // Create a rotation node at the cube's pivot
      const pivotX = cube.pivot ? cube.pivot[0] : cubeCenterX;
      const pivotY = cube.pivot ? cube.pivot[1] : cubeCenterY;
      const pivotZ = cube.pivot ? cube.pivot[2] : cubeCenterZ;

      const rotationNode = new BABYLON.TransformNode(name + "_rot", this._scene);

      // Position relative to bone pivot (in bone's local space, Z negated)
      rotationNode.position = new BABYLON.Vector3(
        (pivotX - bonePivot[0]) / 16,
        (pivotY - bonePivot[1]) / 16,
        -(pivotZ - bonePivot[2]) / 16
      );

      // Apply cube rotation
      rotationNode.rotation = new BABYLON.Vector3(
        BABYLON.Tools.ToRadians(-cube.rotation[0]),
        BABYLON.Tools.ToRadians(-cube.rotation[1]),
        BABYLON.Tools.ToRadians(cube.rotation[2])
      );

      // Mesh position relative to its rotation pivot
      mesh.position = new BABYLON.Vector3(
        (cubeCenterX - pivotX) / 16,
        (cubeCenterY - pivotY) / 16,
        -(cubeCenterZ - pivotZ) / 16
      );

      mesh.parent = rotationNode;
      this._applyMeshSettings(mesh);
      return rotationNode as unknown as BABYLON.Mesh;
    } else {
      // No cube rotation - position relative to bone pivot
      // Z is negated to convert from Minecraft to Babylon coordinate system
      mesh.position = new BABYLON.Vector3(
        (cubeCenterX - bonePivot[0]) / 16,
        (cubeCenterY - bonePivot[1]) / 16,
        -(cubeCenterZ - bonePivot[2]) / 16
      );

      this._applyMeshSettings(mesh);
      return mesh;
    }
  }

  /**
   * Get the accumulated bone transform by walking up the parent hierarchy
   * Returns the combined pivot and rotation that should be applied to cubes in this bone
   * Child bones inherit their parent's bind_pose_rotation
   */
  _getAccumulatedBoneTransform(
    boneName: string,
    boneTransforms: Map<string, BoneTransform>
  ): { pivot: number[]; rotation: number[]; parentPivot: number[]; parentRotation: number[] } {
    const transform = boneTransforms.get(boneName);
    if (!transform) {
      return { pivot: [0, 0, 0], rotation: [0, 0, 0], parentPivot: [0, 0, 0], parentRotation: [0, 0, 0] };
    }

    // Check if this bone has a parent with bind_pose_rotation
    let parentPivot = [0, 0, 0];
    let parentRotation = [0, 0, 0];

    if (transform.parentName) {
      const parentTransform = boneTransforms.get(transform.parentName);
      if (parentTransform) {
        // Check if parent has bind_pose_rotation
        const hasParentRotation =
          parentTransform.rotation[0] !== 0 || parentTransform.rotation[1] !== 0 || parentTransform.rotation[2] !== 0;

        if (hasParentRotation) {
          parentPivot = parentTransform.pivot;
          parentRotation = parentTransform.rotation;
        }
      }
    }

    return {
      pivot: transform.pivot,
      rotation: transform.rotation,
      parentPivot: parentPivot,
      parentRotation: parentRotation,
    };
  }

  /**
   * Rotate a point around a pivot by the given rotation (in degrees)
   */
  _rotatePointAroundPivot(point: number[], pivot: number[], rotationDegrees: number[]): number[] {
    // Convert to radians
    const rx = (rotationDegrees[0] * Math.PI) / 180;
    const ry = (rotationDegrees[1] * Math.PI) / 180;
    const rz = (rotationDegrees[2] * Math.PI) / 180;

    // Translate to pivot origin
    let x = point[0] - pivot[0];
    let y = point[1] - pivot[1];
    let z = point[2] - pivot[2];

    // Apply rotations in order: X, then Y, then Z (Minecraft convention)
    // Rotation around X axis
    if (rx !== 0) {
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const newY = y * cosX - z * sinX;
      const newZ = y * sinX + z * cosX;
      y = newY;
      z = newZ;
    }

    // Rotation around Y axis
    if (ry !== 0) {
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const newX = x * cosY + z * sinY;
      const newZ = -x * sinY + z * cosY;
      x = newX;
      z = newZ;
    }

    // Rotation around Z axis
    if (rz !== 0) {
      const cosZ = Math.cos(rz);
      const sinZ = Math.sin(rz);
      const newX = x * cosZ - y * sinZ;
      const newY = x * sinZ + y * cosZ;
      x = newX;
      y = newY;
    }

    // Translate back from pivot
    return [x + pivot[0], y + pivot[1], z + pivot[2]];
  }

  _createCubeMesh(
    name: string,
    cube: IGeometryBoneCube,
    boneTransform: { pivot: number[]; rotation: number[]; parentPivot: number[]; parentRotation: number[] },
    texWidth: number,
    texHeight: number,
    material: BABYLON.StandardMaterial
  ): BABYLON.Mesh | undefined {
    const origin = cube.origin;
    const size = cube.size;
    const inflate = cube.inflate || 0;

    // Calculate actual size with inflation
    const actualWidth = (size[0] + inflate * 2) / 16;
    const actualHeight = (size[1] + inflate * 2) / 16;
    const actualDepth = (size[2] + inflate * 2) / 16;

    // Check if this is a flat plane (one dimension is 0)
    // Used for fins, wings, etc.
    const isPlaneX = size[0] === 0;
    const isPlaneY = size[1] === 0;
    const isPlaneZ = size[2] === 0;
    const isPlane = isPlaneX || isPlaneY || isPlaneZ;

    let mesh: BABYLON.Mesh;

    if (isPlane) {
      // Create a double-sided plane for flat geometry
      mesh = this._createPlaneMesh(name, cube, size, texWidth, texHeight, material, isPlaneX, isPlaneY, isPlaneZ);
    } else {
      // Calculate face UVs - pass rotation so UVs can be assigned to correct rotated faces
      const faceUVs = this._calculateFaceUVs(cube, size, texWidth, texHeight);

      const options = {
        width: actualWidth,
        height: actualHeight,
        depth: actualDepth,
        faceUV: faceUVs,
        wrap: true,
      };

      mesh = BABYLON.MeshBuilder.CreateBox(name, options, this._scene);
      mesh.material = material;
    }

    // Cube center in Minecraft coordinates (origin is min corner)
    const cubeCenterX = origin[0] + size[0] / 2;
    const cubeCenterY = origin[1] + size[1] / 2;
    const cubeCenterZ = origin[2] + size[2] / 2;

    // Check if bone has bind_pose_rotation that needs to be applied
    const hasBoneRotation =
      boneTransform.rotation[0] !== 0 || boneTransform.rotation[1] !== 0 || boneTransform.rotation[2] !== 0;

    // Check if parent bone has bind_pose_rotation (for child bones like head, legs)
    const hasParentRotation =
      boneTransform.parentRotation[0] !== 0 ||
      boneTransform.parentRotation[1] !== 0 ||
      boneTransform.parentRotation[2] !== 0;

    // Handle cube rotation
    if (cube.rotation) {
      // Cube has its own rotation - need to rotate around the pivot point
      // If no pivot specified, use the cube's center as the pivot
      const pivotX = cube.pivot ? cube.pivot[0] : origin[0] + size[0] / 2;
      const pivotY = cube.pivot ? cube.pivot[1] : origin[1] + size[1] / 2;
      const pivotZ = cube.pivot ? cube.pivot[2] : origin[2] + size[2] / 2;

      // Create parent transform at pivot, apply rotation, position mesh relative to pivot
      const rotationNode = new BABYLON.TransformNode(name + "_rot", this._scene);

      // Pivot position in Babylon coordinates (negate Z)
      rotationNode.position = new BABYLON.Vector3(pivotX / 16, pivotY / 16, -pivotZ / 16);

      // Apply cube rotation
      // When Z is negated for Babylon, X rotation direction is also inverted
      rotationNode.rotation = new BABYLON.Vector3(
        BABYLON.Tools.ToRadians(-cube.rotation[0]),
        BABYLON.Tools.ToRadians(-cube.rotation[1]),
        BABYLON.Tools.ToRadians(cube.rotation[2])
      );

      // Mesh position relative to pivot (with Z negation for the offset)
      mesh.position = new BABYLON.Vector3(
        (cubeCenterX - pivotX) / 16,
        (cubeCenterY - pivotY) / 16,
        -(cubeCenterZ - pivotZ) / 16
      );

      mesh.parent = rotationNode;

      // If parent bone has rotation (this is a child bone), wrap in parent rotation
      if (hasParentRotation) {
        const parentRotNode = new BABYLON.TransformNode(name + "_parentrot", this._scene);

        parentRotNode.position = new BABYLON.Vector3(
          boneTransform.parentPivot[0] / 16,
          boneTransform.parentPivot[1] / 16,
          -boneTransform.parentPivot[2] / 16
        );

        parentRotNode.rotation = new BABYLON.Vector3(
          BABYLON.Tools.ToRadians(-boneTransform.parentRotation[0]),
          BABYLON.Tools.ToRadians(-boneTransform.parentRotation[1]),
          BABYLON.Tools.ToRadians(boneTransform.parentRotation[2])
        );

        rotationNode.position = new BABYLON.Vector3(
          (pivotX - boneTransform.parentPivot[0]) / 16,
          (pivotY - boneTransform.parentPivot[1]) / 16,
          -(pivotZ - boneTransform.parentPivot[2]) / 16
        );

        rotationNode.parent = parentRotNode;
        this._applyMeshSettings(mesh);
        return parentRotNode as unknown as BABYLON.Mesh;
      }

      // If bone itself has rotation, wrap in bone rotation
      if (hasBoneRotation) {
        const boneRotNode = new BABYLON.TransformNode(name + "_bonerot", this._scene);

        boneRotNode.position = new BABYLON.Vector3(
          boneTransform.pivot[0] / 16,
          boneTransform.pivot[1] / 16,
          -boneTransform.pivot[2] / 16
        );

        boneRotNode.rotation = new BABYLON.Vector3(
          BABYLON.Tools.ToRadians(-boneTransform.rotation[0]),
          BABYLON.Tools.ToRadians(-boneTransform.rotation[1]),
          BABYLON.Tools.ToRadians(boneTransform.rotation[2])
        );

        rotationNode.position = new BABYLON.Vector3(
          (pivotX - boneTransform.pivot[0]) / 16,
          (pivotY - boneTransform.pivot[1]) / 16,
          -(pivotZ - boneTransform.pivot[2]) / 16
        );

        rotationNode.parent = boneRotNode;
        this._applyMeshSettings(mesh);
        return boneRotNode as unknown as BABYLON.Mesh;
      }

      this._applyMeshSettings(mesh);
      return rotationNode as unknown as BABYLON.Mesh;
    } else if (hasParentRotation) {
      // Parent bone has rotation (this is a child bone like head/legs)
      const rotationNode = new BABYLON.TransformNode(name + "_parentrot", this._scene);

      rotationNode.position = new BABYLON.Vector3(
        boneTransform.parentPivot[0] / 16,
        boneTransform.parentPivot[1] / 16,
        -boneTransform.parentPivot[2] / 16
      );

      rotationNode.rotation = new BABYLON.Vector3(
        BABYLON.Tools.ToRadians(-boneTransform.parentRotation[0]),
        BABYLON.Tools.ToRadians(-boneTransform.parentRotation[1]),
        BABYLON.Tools.ToRadians(boneTransform.parentRotation[2])
      );

      mesh.position = new BABYLON.Vector3(
        (cubeCenterX - boneTransform.parentPivot[0]) / 16,
        (cubeCenterY - boneTransform.parentPivot[1]) / 16,
        -(cubeCenterZ - boneTransform.parentPivot[2]) / 16
      );

      mesh.parent = rotationNode;
      this._applyMeshSettings(mesh);
      return rotationNode as unknown as BABYLON.Mesh;
    } else if (hasBoneRotation) {
      // Bone rotation only (no cube rotation)
      // Create a transform node for the mesh with bone rotation
      const rotationNode = new BABYLON.TransformNode(name + "_bonerot", this._scene);

      // Use bone pivot as the rotation center
      const bonePivotX = boneTransform.pivot[0];
      const bonePivotY = boneTransform.pivot[1];
      const bonePivotZ = boneTransform.pivot[2];

      // Position the rotation node at the bone pivot
      rotationNode.position = new BABYLON.Vector3(bonePivotX / 16, bonePivotY / 16, -bonePivotZ / 16);

      // Apply bone rotation
      // When Z is negated for Babylon, X rotation direction is also inverted
      // (rotating around X in a left-handed vs right-handed system)
      rotationNode.rotation = new BABYLON.Vector3(
        BABYLON.Tools.ToRadians(-boneTransform.rotation[0]),
        BABYLON.Tools.ToRadians(-boneTransform.rotation[1]),
        BABYLON.Tools.ToRadians(boneTransform.rotation[2])
      );

      // Mesh position relative to bone pivot (with Z negation for the offset)
      mesh.position = new BABYLON.Vector3(
        (cubeCenterX - bonePivotX) / 16,
        (cubeCenterY - bonePivotY) / 16,
        -(cubeCenterZ - bonePivotZ) / 16
      );

      mesh.parent = rotationNode;
      this._applyMeshSettings(mesh);

      return rotationNode as unknown as BABYLON.Mesh;
    } else {
      // No rotation - position at world space
      mesh.position = new BABYLON.Vector3(cubeCenterX / 16, cubeCenterY / 16, -cubeCenterZ / 16);

      this._applyMeshSettings(mesh);
      return mesh;
    }
  }

  _createPlaneMesh(
    name: string,
    cube: IGeometryBoneCube,
    size: number[],
    texWidth: number,
    texHeight: number,
    material: BABYLON.StandardMaterial,
    isPlaneX: boolean,
    isPlaneY: boolean,
    isPlaneZ: boolean
  ): BABYLON.Mesh {
    // Calculate UV for the visible face
    // For planes, the UV is typically specified for the flat face
    const u = Array.isArray(cube.uv) ? cube.uv[0] : 0;
    const v = Array.isArray(cube.uv) ? cube.uv[1] : 0;

    let planeWidth: number;
    let planeHeight: number;
    let uvWidth: number;
    let uvHeight: number;

    if (isPlaneX) {
      // YZ plane (facing X direction)
      planeWidth = size[2] / 16; // depth becomes width
      planeHeight = size[1] / 16; // height stays height
      uvWidth = size[2];
      uvHeight = size[1];
    } else if (isPlaneY) {
      // XZ plane (facing Y direction)
      planeWidth = size[0] / 16;
      planeHeight = size[2] / 16;
      uvWidth = size[0];
      uvHeight = size[2];
    } else {
      // XY plane (facing Z direction)
      planeWidth = size[0] / 16;
      planeHeight = size[1] / 16;
      uvWidth = size[0];
      uvHeight = size[1];
    }

    // Handle negative UV values by taking absolute value and adjusting
    const absU = Math.abs(u);
    const absV = Math.abs(v);
    const faceUV = this._uvToVector4(absU, absV, uvWidth, uvHeight, texWidth, texHeight);

    // Create a double-sided plane
    const plane = BABYLON.MeshBuilder.CreatePlane(
      name,
      {
        width: planeWidth,
        height: planeHeight,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        frontUVs: faceUV,
        backUVs: faceUV,
      },
      this._scene
    );

    plane.material = material;

    // Rotate plane to face the correct direction
    if (isPlaneX) {
      plane.rotation.y = Math.PI / 2;
    } else if (isPlaneY) {
      plane.rotation.x = Math.PI / 2;
    }
    // isPlaneZ is default orientation (facing Z)

    return plane;
  }

  /**
   * Create a flat sprite mesh from a texture_mesh definition.
   *
   * A texture_mesh renders the entire texture as a flat double-sided plane in 3D space,
   * where each pixel maps to 1/16 of a block unit. This is used by items like bow and
   * crossbow to display their 2D item sprites.
   *
   * IMPORTANT: The rotation/position in the geometry JSON is designed for in-hand display
   * (how the item looks when held by a player), NOT for standalone viewing. For standalone
   * rendering, we ignore the rotation and present the sprite face-on to the camera,
   * centered in the scene at a reasonable height.
   *
   * @param meshName - Babylon mesh name
   * @param texMesh - The texture_mesh definition from the geometry bone
   * @param texWidth - Texture width in pixels
   * @param texHeight - Texture height in pixels
   * @param material - Babylon material with the texture already loaded
   */
  private _createTextureMeshSprite(
    meshName: string,
    texMesh: IGeometryBoneTextureMesh,
    texWidth: number,
    texHeight: number,
    material: BABYLON.StandardMaterial
  ): BABYLON.Mesh | undefined {
    // Each pixel = 1/16 block unit, so the plane size in block units is texSize / 16
    const planeWidth = texWidth / 16;
    const planeHeight = texHeight / 16;

    // Full-texture UV covering the entire image
    const fullUV = new BABYLON.Vector4(0, 0, 1, 1);

    const plane = BABYLON.MeshBuilder.CreatePlane(
      meshName,
      {
        width: planeWidth,
        height: planeHeight,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        frontUVs: fullUV,
        backUVs: fullUV,
      },
      this._scene
    );

    plane.material = material;

    // For standalone item rendering, ignore the in-geometry rotation/position
    // (which is designed for in-hand display) and present the sprite face-on.
    // Position centered, raised half the plane height so it sits on the ground plane.
    plane.position = new BABYLON.Vector3(0, planeHeight / 2, 0);

    // Apply scale if present
    if (texMesh.scale) {
      plane.scaling = new BABYLON.Vector3(texMesh.scale[0], texMesh.scale[1], texMesh.scale[2]);
    }

    this._applyMeshSettings(plane);

    return plane;
  }

  _calculateFaceUVs(cube: IGeometryBoneCube, size: number[], texWidth: number, texHeight: number): BABYLON.Vector4[] {
    // Build a map: minecraft face name -> UV data
    const mcFaceUVs: { [key: string]: BABYLON.Vector4 } = {};

    if (Array.isArray(cube.uv) && cube.uv.length === 2) {
      // Standard Minecraft box UV layout:
      //
      //            u    u+d  u+d+w u+d+w+d u+2d+2w
      //        v        +-----+----+
      //                 | Up  |Down|     <- Top row: height = d
      //      v+d   +----+-----+----+----+
      //            |East|North|West|South|  <- Bottom row: height = h
      //    v+d+h   +----+-----+----+----+
      //            | d  | w   | d  | w  |

      // Legacy UV format - single [u, v] offset for standard box unwrap
      const u = cube.uv[0];
      const v = cube.uv[1];
      const w = size[0]; // width (X dimension)
      const h = size[1]; // height (Y dimension)
      const d = size[2]; // depth (Z dimension)

      mcFaceUVs["east"] = this._uvToVector4(u, v + d, d, h, texWidth, texHeight);
      mcFaceUVs["north"] = this._uvToVector4(u + d, v + d, w, h, texWidth, texHeight);
      mcFaceUVs["west"] = this._uvToVector4(u + d + w, v + d, d, h, texWidth, texHeight);
      mcFaceUVs["south"] = this._uvToVector4(u + d + w + d, v + d, w, h, texWidth, texHeight);
      mcFaceUVs["up"] = this._uvToVector4(u + d, v, w, d, texWidth, texHeight);
      mcFaceUVs["down"] = this._uvToVector4(u + d + w, v, w, d, texWidth, texHeight);
    } else if (cube.uv && typeof cube.uv === "object") {
      // Per-face UV format
      const uvFaces = cube.uv as IGeometryUVFaces;
      mcFaceUVs["east"] = this._faceUVToVector4(uvFaces.east, texWidth, texHeight);
      mcFaceUVs["north"] = this._faceUVToVector4(uvFaces.north, texWidth, texHeight);
      mcFaceUVs["west"] = this._faceUVToVector4(uvFaces.west, texWidth, texHeight);
      mcFaceUVs["south"] = this._faceUVToVector4(uvFaces.south, texWidth, texHeight);
      mcFaceUVs["up"] = this._faceUVToVector4(uvFaces.up, texWidth, texHeight);
      mcFaceUVs["down"] = this._faceUVToVector4(uvFaces.down, texWidth, texHeight);
    } else {
      // Default UV - use full texture
      const defaultUV = new BABYLON.Vector4(0, 0, 1, 1);
      return [defaultUV, defaultUV, defaultUV, defaultUV, defaultUV, defaultUV];
    }

    // Babylon.js CreateBox faceUV order (verified from BabylonJS source):
    //   [0] = front  (+Z in Babylon local space)
    //   [1] = back   (-Z in Babylon local space)
    //   [2] = right  (+X in Babylon local space)
    //   [3] = left   (-X in Babylon local space)
    //   [4] = top    (+Y in Babylon local space)
    //   [5] = bottom (-Y in Babylon local space)

    // We negate Z when positioning meshes (Minecraft +Z -> Babylon -Z):
    //   Minecraft North (-Z) -> Babylon (+Z) = front [0]
    //   Minecraft South (+Z) -> Babylon (-Z) = back [1]
    //   Minecraft East  (+X) -> Babylon (+X) = right [2]
    //   Minecraft West  (-X) -> Babylon (-X) = left [3]
    //   Minecraft Up    (+Y) -> Babylon (+Y) = top [4]
    //   Minecraft Down  (-Y) -> Babylon (-Y) = bottom [5]
    let faceMapping = ["north", "south", "east", "west", "up", "down"];

    const faceUVs: BABYLON.Vector4[] = [];
    for (const faceName of faceMapping) {
      faceUVs.push(mcFaceUVs[faceName] || new BABYLON.Vector4(0, 0, 1, 1));
    }

    return faceUVs;
  }

  _uvToVector4(
    u: number,
    v: number,
    width: number,
    height: number,
    texWidth: number,
    texHeight: number
  ): BABYLON.Vector4 {
    // Convert pixel coordinates to normalized UV coordinates
    // Minecraft UV: origin at top-left, V increases downward (0 = top, texHeight = bottom)
    // Babylon UV with invertY=true: texture is flipped, so effectively top-left origin too
    // BUT faceUV Vector4 (uMin, vMin, uMax, vMax) still uses bottom-left convention
    // So we need to flip V coordinates for faceUV
    const uMin = u / texWidth;
    const uMax = (u + width) / texWidth;
    // Flip V for faceUV: Minecraft top (v) -> Babylon bottom (1 - (v+height)/texHeight)
    const vMin = 1 - (v + height) / texHeight;
    const vMax = 1 - v / texHeight;

    return new BABYLON.Vector4(uMin, vMin, uMax, vMax);
  }

  _faceUVToVector4(face: IGeometryUVFace | undefined, texWidth: number, texHeight: number): BABYLON.Vector4 {
    if (!face || !face.uv || !face.uv_size) {
      return new BABYLON.Vector4(0, 0, 0, 0); // Invisible face
    }

    const u = face.uv[0];
    const v = face.uv[1];
    const width = face.uv_size[0];
    const height = face.uv_size[1];

    return this._uvToVector4(u, v, width, height, texWidth, texHeight);
  }

  _createPolyMesh(
    name: string,
    polyMesh: IGeometryPolyMesh,
    bonePivot: number[],
    texWidth: number,
    texHeight: number,
    material: BABYLON.StandardMaterial
  ): BABYLON.Mesh | undefined {
    if (!polyMesh.positions || !polyMesh.polys) {
      return undefined;
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const srcPositions = polyMesh.positions;
    const srcNormals = polyMesh.normals || [];
    const srcUVs = polyMesh.uvs || [];
    const normalizedUVs = polyMesh.normalized_uvs || false;

    // Handle different poly formats
    if (Array.isArray(polyMesh.polys)) {
      let vertexIndex = 0;

      for (const poly of polyMesh.polys) {
        const vertexCount = poly.length;

        // Each vertex in the polygon is [posIndex, normalIndex, uvIndex]
        for (let i = 0; i < vertexCount; i++) {
          const vertex = poly[i];
          const posIdx = vertex[0];
          const normIdx = vertex[1];
          const uvIdx = vertex[2];

          // Position (convert from Minecraft coords and apply pivot offset)
          // Negate Z for coordinate system conversion
          const pos = srcPositions[posIdx];
          positions.push((pos[0] - bonePivot[0]) / 16, (pos[1] - bonePivot[1]) / 16, -(pos[2] - bonePivot[2]) / 16);

          // Normal (negate Z)
          if (srcNormals[normIdx]) {
            const norm = srcNormals[normIdx];
            normals.push(norm[0], norm[1], -norm[2]);
          } else {
            normals.push(0, 1, 0);
          }

          // UV
          if (srcUVs[uvIdx]) {
            const uv = srcUVs[uvIdx];
            if (normalizedUVs) {
              uvs.push(uv[0], 1 - uv[1]);
            } else {
              uvs.push(uv[0] / texWidth, 1 - uv[1] / texHeight);
            }
          } else {
            uvs.push(0, 0);
          }
        }

        // Create triangles (fan triangulation for quads/polygons)
        // Reverse winding order due to Z flip
        for (let i = 1; i < vertexCount - 1; i++) {
          indices.push(vertexIndex, vertexIndex + i + 1, vertexIndex + i);
        }

        vertexIndex += vertexCount;
      }
    }

    if (positions.length === 0) {
      return undefined;
    }

    const mesh = new BABYLON.Mesh(name, this._scene);
    const vertexData = new BABYLON.VertexData();

    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;

    vertexData.applyToMesh(mesh);
    mesh.material = material;

    this._applyMeshSettings(mesh);
    return mesh;
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

  _applyMeshSettings(mesh: BABYLON.Mesh) {
    mesh.cullingStrategy = BABYLON.AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
  }

  /**
   * Apply a tint color to all materials on a mesh and its children.
   * Used for entities with colored overlays (e.g., sheep wool).
   * Multiplies the material's diffuse color by the tint.
   */
  applyTintColor(mesh: BABYLON.Mesh, tint: { r: number; g: number; b: number; a: number }) {
    const applyToMat = (mat: BABYLON.Material | null) => {
      if (mat instanceof BABYLON.StandardMaterial) {
        mat.unfreeze();
        mat.diffuseColor = new BABYLON.Color3(tint.r, tint.g, tint.b);
        if (tint.a < 1.0) {
          mat.alpha = tint.a;
        }
        mat.freeze();
      }
    };

    applyToMat(mesh.material);
    for (const child of mesh.getChildMeshes()) {
      applyToMat(child.material);
    }
  }

  /**
   * Make all materials on a mesh fully opaque by disabling alpha.
   * Used for entities whose textures have near-zero alpha body pixels
   * designed for multi-layer overlay rendering (e.g., sheep).
   */
  applyIgnoreAlpha(mesh: BABYLON.Mesh) {
    const applyToMat = (mat: BABYLON.Material | null) => {
      if (mat instanceof BABYLON.StandardMaterial) {
        mat.unfreeze();
        if (mat.diffuseTexture) {
          mat.diffuseTexture.hasAlpha = false;
        }
        mat.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
        mat.useAlphaFromDiffuseTexture = false;
        mat.alpha = 1.0;
        mat.freeze();
      }
    };

    applyToMat(mesh.material);
    for (const child of mesh.getChildMeshes()) {
      applyToMat(child.material);
    }
  }

  _ensureMaterialByPath(path: string) {
    let mat = this._materials.get(path);

    if (!mat) {
      mat = new BABYLON.StandardMaterial("mat." + name, this._scene);
      mat.alpha = 1.0;

      const texture = new BABYLON.Texture(CreatorToolsHost.getVanillaContentRoot() + path, this._scene, true, false, 8);
      texture.anisotropicFilteringLevel = 10;
      texture.hasAlpha = true;

      mat.diffuseTexture = texture;
      mat.backFaceCulling = true;
      // mat.opacityTexture = texture;

      this._materials.set(path, mat);
      mat.freeze();
    }

    return mat;
  }

  ensureMaterial(
    name: string,
    imageData?: Uint8Array,
    textureUrl?: string,
    textureWidth?: number,
    textureHeight?: number,
    fileExtension?: string
  ): BABYLON.StandardMaterial {
    // Create a unique key that includes texture data characteristics
    // to prevent reusing materials with different textures
    let textureHash: string;
    if (imageData && imageData.length > 0) {
      textureHash =
        imageData.length +
        "_" +
        (imageData.length > 0 ? imageData[0] : 0) +
        "_" +
        (imageData.length > 100 ? imageData[100] : 0) +
        "_" +
        (imageData.length > 500 ? imageData[500] : 0);
    } else if (textureUrl) {
      textureHash = "url_" + textureUrl;
    } else {
      textureHash = "empty";
    }
    const materialKey = name + "_" + textureHash;

    let mat = this._materials.get(materialKey);

    if (!mat) {
      mat = new BABYLON.StandardMaterial("mat." + materialKey, this._scene);
      mat.alpha = 1.0;

      let texture: BABYLON.Texture | BABYLON.RawTexture;

      // Detect image format - check explicit formats first
      const isPng = imageData && imageData.length > 0 && ImageCodec.isPngData(imageData);
      const isJpeg = imageData && imageData.length > 0 && ImageCodec.isJpegData(imageData);

      // Check if this is a TGA file - by extension or header detection
      // Also treat unknown formats (not PNG/JPEG) as potential TGA since TGA has no magic number
      const isTga =
        fileExtension?.toLowerCase() === "tga" || (imageData && imageData.length > 0 && this._isTgaData(imageData));

      // If imageData exists but isn't PNG/JPEG, assume it might be TGA (fallback)
      const treatAsTga = isTga || (imageData && imageData.length > 0 && !isPng && !isJpeg);

      if (imageData && imageData.length > 0 && treatAsTga) {
        // TGA file (or unknown format we'll try to decode as TGA)
        // Decode asynchronously and update material when ready
        Log.verbose(
          `[ModelMeshFactory] TGA texture detected (ext=${fileExtension}, bytes[0-2]=${imageData[0]},${imageData[1]},${imageData[2]}), decoding...`
        );

        // Create a 1x1 placeholder texture while TGA is being decoded
        const placeholderData = new Uint8Array([128, 128, 128, 255]); // Gray pixel
        texture = new BABYLON.RawTexture(
          placeholderData,
          1,
          1,
          BABYLON.Engine.TEXTUREFORMAT_RGBA,
          this._scene,
          false, // generateMipMaps
          true, // invertY
          BABYLON.Texture.NEAREST_SAMPLINGMODE
        );

        // Decode TGA asynchronously and update the texture
        this._decodeTgaAndUpdateMaterial(mat, imageData, textureWidth || 64, textureHeight || 64);
      } else if (imageData && imageData.length > 0 && (isPng || isJpeg)) {
        // PNG/JPG - decode to raw RGBA pixels and use RawTexture
        // This approach is more reliable than using data URLs which can cause
        // "texImage2D: bad image data" errors due to timing issues

        // Create a 1x1 placeholder texture (gray) while image is being decoded
        const placeholderData = new Uint8Array([128, 128, 128, 255]);
        texture = new BABYLON.RawTexture(
          placeholderData,
          1,
          1,
          BABYLON.Engine.TEXTUREFORMAT_RGBA,
          this._scene,
          false, // generateMipMaps
          true, // invertY
          BABYLON.Texture.NEAREST_SAMPLINGMODE
        );

        // Decode PNG/JPEG asynchronously and update material
        this._decodePngAndUpdateMaterial(mat, imageData, textureWidth || 64, textureHeight || 64);
      } else if (textureUrl) {
        // Check if the URL points to a TGA file - browsers can't load TGA directly
        const urlLower = textureUrl.toLowerCase();
        if (urlLower.endsWith(".tga")) {
          // TGA URL - need to fetch and decode asynchronously
          Log.verbose(`[ModelMeshFactory] TGA texture URL detected: ${textureUrl}`);

          // Create a 1x1 placeholder texture while TGA is being fetched and decoded
          const placeholderData = new Uint8Array([128, 128, 128, 255]); // Gray pixel
          texture = new BABYLON.RawTexture(
            placeholderData,
            1,
            1,
            BABYLON.Engine.TEXTUREFORMAT_RGBA,
            this._scene,
            false, // generateMipMaps
            true, // invertY
            BABYLON.Texture.NEAREST_SAMPLINGMODE
          );

          // Fetch and decode TGA asynchronously
          this._fetchAndDecodeTgaUrl(mat, textureUrl, textureWidth || 64, textureHeight || 64);
        } else {
          // PNG/JPG URL - load directly via Babylon.js
          texture = new BABYLON.Texture(
            textureUrl,
            this._scene,
            true, // noMipmap - true for pixel art to keep sharp edges
            true, // invertY - true to flip texture from PNG top-left origin to Babylon bottom-left
            BABYLON.Texture.NEAREST_SAMPLINGMODE,
            undefined,
            (message) => {
              Log.verbose("Error loading texture from URL: " + textureUrl + " - " + message);
            }
          );
        }
      } else {
        // No texture data or URL, create a placeholder
        Log.debugAlert("No texture data or URL provided for material: " + name);
        texture = new BABYLON.Texture(null, this._scene, true, true, BABYLON.Texture.NEAREST_SAMPLINGMODE);
      }

      texture.anisotropicFilteringLevel = 1; // Disable for pixel art
      texture.hasAlpha = true;
      texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

      mat.diffuseTexture = texture;
      // Disable back-face culling for entity models. In Minecraft, entity rendering
      // shows back faces — important for entities with alpha-tested textures
      // (like the skeleton's rib cage) where back faces must be visible through
      // transparent gaps in the front face.
      mat.backFaceCulling = false;
      // Enable two-sided lighting so back faces receive proper illumination
      // instead of appearing dark (which happens when normals point away from camera).
      mat.twoSidedLighting = true;

      this._materials.set(materialKey, mat);
      mat.freeze();
    }

    return mat;
  }

  /**
   * Check if the image data looks like a TGA file by checking the header.
   * Delegates to ImageCodec for consistent format detection.
   * @deprecated Use ImageCodec.isTgaData() directly
   */
  _isTgaData(data: Uint8Array): boolean {
    return ImageCodec.isTgaData(data);
  }

  /**
   * Decode TGA data asynchronously and update the material's texture.
   */
  async _decodeTgaAndUpdateMaterial(
    material: BABYLON.StandardMaterial,
    tgaData: Uint8Array,
    expectedWidth: number,
    expectedHeight: number
  ): Promise<void> {
    try {
      const decoded = await ImageCodec.decodeTga(tgaData);
      if (!decoded) {
        Log.verbose("[ModelMeshFactory] Failed to decode TGA");
        return;
      }

      const width = decoded.width;
      const height = decoded.height;

      Log.verbose(`[ModelMeshFactory] TGA decoded: ${width}x${height}`);

      // The decoded pixels are already in RGBA format
      const rgbaData = decoded.pixels;

      // Create a new RawTexture with the decoded data
      const newTexture = new BABYLON.RawTexture(
        rgbaData,
        width,
        height,
        BABYLON.Engine.TEXTUREFORMAT_RGBA,
        this._scene,
        false, // generateMipMaps
        true, // invertY - TGA origin is usually bottom-left
        BABYLON.Texture.NEAREST_SAMPLINGMODE
      );

      newTexture.anisotropicFilteringLevel = 1;
      newTexture.hasAlpha = true;
      newTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
      newTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

      // Unfreeze the material to update it
      material.unfreeze();

      // Dispose the old placeholder texture
      if (material.diffuseTexture) {
        material.diffuseTexture.dispose();
      }

      // Set the new texture
      material.diffuseTexture = newTexture;
      material.freeze();

      Log.verbose(`[ModelMeshFactory] TGA texture applied successfully`);
    } catch (error) {
      Log.verbose("[ModelMeshFactory] Failed to decode TGA: " + error);
    }
  }

  /**
   * Decode PNG/JPEG data asynchronously and update the material's texture.
   * Uses browser's createImageBitmap for reliable decoding without WebGL timing issues.
   */
  async _decodePngAndUpdateMaterial(
    material: BABYLON.StandardMaterial,
    pngData: Uint8Array,
    expectedWidth: number,
    expectedHeight: number
  ): Promise<void> {
    try {
      // Verify this looks like a valid PNG
      // PNG signature: 137 80 78 71 13 10 26 10
      const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
      let isValidPng = pngData.length >= 8;
      for (let i = 0; i < 8 && isValidPng; i++) {
        if (pngData[i] !== pngSignature[i]) {
          isValidPng = false;
          Log.debug(
            `[ModelMeshFactory] PNG signature mismatch at byte ${i}: got ${pngData[i]}, expected ${pngSignature[i]}`
          );
        }
      }

      if (!isValidPng) {
        Log.debug("[ModelMeshFactory] Invalid PNG data - does not have correct PNG signature");
        return;
      }

      // Create a Blob from the PNG data
      const blob = new Blob([pngData], { type: "image/png" });

      // Use createImageBitmap for async decoding (available in modern browsers)
      const imageBitmap = await createImageBitmap(blob);

      const width = imageBitmap.width;
      const height = imageBitmap.height;

      // Draw to canvas to extract RGBA pixels
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        Log.debug("[ModelMeshFactory] Failed to get canvas context");
        return;
      }

      ctx.drawImage(imageBitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const rgbaData = new Uint8Array(imageData.data.buffer);

      // Create a new RawTexture with the decoded data
      const newTexture = new BABYLON.RawTexture(
        rgbaData,
        width,
        height,
        BABYLON.Engine.TEXTUREFORMAT_RGBA,
        this._scene,
        false, // generateMipMaps
        true, // invertY - PNG origin is top-left
        BABYLON.Texture.NEAREST_SAMPLINGMODE
      );

      newTexture.anisotropicFilteringLevel = 1;
      newTexture.hasAlpha = true;
      newTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
      newTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

      // Unfreeze the material to update it
      material.unfreeze();

      // Dispose the old placeholder texture
      if (material.diffuseTexture) {
        material.diffuseTexture.dispose();
      }

      // Set the new texture
      material.diffuseTexture = newTexture;
      material.freeze();
    } catch (error) {
      Log.debug("[ModelMeshFactory] Failed to decode PNG: " + error);
    }
  }

  /**
   * Fetch TGA data from URL and decode it to update the material's texture.
   * Used when textureUrl points to a .tga file which browsers can't load directly.
   */
  async _fetchAndDecodeTgaUrl(
    material: BABYLON.StandardMaterial,
    tgaUrl: string,
    expectedWidth: number,
    expectedHeight: number
  ): Promise<void> {
    try {
      Log.verbose(`[ModelMeshFactory] Fetching TGA from URL: ${tgaUrl}`);

      const response = await fetch(tgaUrl);
      if (!response.ok) {
        Log.verbose(`[ModelMeshFactory] Failed to fetch TGA: ${response.status} ${response.statusText}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const tgaData = new Uint8Array(arrayBuffer);

      Log.verbose(`[ModelMeshFactory] TGA fetched, size=${tgaData.length} bytes`);

      // Decode TGA using the existing method
      await this._decodeTgaAndUpdateMaterial(material, tgaData, expectedWidth, expectedHeight);
    } catch (error) {
      Log.verbose("[ModelMeshFactory] Failed to fetch/decode TGA from URL: " + error);
    }
  }
  /**
   * Load a texture from a data URL and update the material when ready.
   * This avoids WebGL "bad image data" errors that occur when rendering before texture is decoded.
   */
  async _loadTextureFromDataUrl(
    material: BABYLON.StandardMaterial,
    dataUrl: string,
    expectedWidth: number,
    expectedHeight: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const newTexture = new BABYLON.Texture(
        dataUrl,
        this._scene,
        true, // noMipmap - true for pixel art to keep sharp edges
        true, // invertY - true to flip texture from PNG top-left origin to Babylon bottom-left
        BABYLON.Texture.NEAREST_SAMPLINGMODE,
        () => {
          // Texture loaded successfully - swap it into the material
          newTexture.anisotropicFilteringLevel = 1;
          newTexture.hasAlpha = true;
          newTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
          newTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

          // Unfreeze the material to update it
          material.unfreeze();

          // Dispose the old placeholder texture
          if (material.diffuseTexture) {
            material.diffuseTexture.dispose();
          }

          // Set the new texture
          material.diffuseTexture = newTexture;
          material.freeze();

          resolve();
        },
        (message, exception) => {
          Log.debug("[ModelMeshFactory] Error loading texture from data URL: " + message + " " + exception);
          resolve();
        }
      );
    });
  }
}
