/**
 * VanillaGeometryTransforms
 *
 * This module provides transforms for vanilla Minecraft geometry files that need
 * manual corrections because Minecraft's rendering code has hardcoded optimizations
 * that affect how certain models appear.
 *
 * The Minecraft game engine contains special rendering logic for certain entities
 * that isn't represented in the geometry files themselves. This transform system
 * allows MCTools to replicate those visual adjustments so models render correctly.
 *
 * Last Updated: December 2025
 */

import { IGeometry } from "./IModelGeometry";
import Log from "../core/Log";

/**
 * Represents a transform operation that can be applied to a bone
 */
export interface IBoneTransform {
  /**
   * Name of the bone to transform. Use "*" for all bones.
   */
  boneName: string;

  /**
   * If set, adds this rotation (in degrees) to the bone's bind_pose_rotation
   */
  addBindPoseRotation?: [number, number, number];

  /**
   * If set, replaces the bone's bind_pose_rotation
   */
  setBindPoseRotation?: [number, number, number];

  /**
   * If set, adds this offset (in pixels) to the bone's pivot
   */
  addPivotOffset?: [number, number, number];

  /**
   * If set, replaces the bone's pivot
   */
  setPivot?: [number, number, number];

  /**
   * If set, adds this offset (in pixels) to all cube origins in this bone
   */
  addCubeOriginOffset?: [number, number, number];

  /**
   * If set, changes the parent of this bone
   */
  setParent?: string | null;

  /**
   * If set, removes the parent (makes bone a root bone)
   */
  removeParent?: boolean;

  /**
   * If set, adds a per-cube rotation (in degrees) to every cube in this bone.
   * Unlike setBindPoseRotation, this does NOT rotate the bone's TransformNode,
   * so child bones keep their world-space positions.
   * The cube's rotation pivot is set to the bone's pivot.
   */
  setCubeRotation?: [number, number, number];
}

/**
 * Represents all transforms to apply to a specific vanilla geometry
 */
export interface IVanillaGeometryTransform {
  /**
   * Geometry identifier patterns this transform applies to.
   * Supports wildcards: "geometry.cow.*" matches any cow geometry variant
   */
  geometryPatterns: string[];

  /**
   * Human-readable description of why this transform is needed
   */
  reason: string;

  /**
   * Array of bone transforms to apply in order
   */
  boneTransforms: IBoneTransform[];
}

/**
 * Registry of all vanilla geometry transforms.
 *
 * When adding new transforms:
 * 1. Document why Minecraft renders this model differently
 * 2. Specify the exact geometry patterns that need correction
 * 3. Apply minimal transforms to achieve correct appearance
 *
 * IMPORTANT: Most vanilla entities now use v2/v3 geometry formats that have correct
 * cube-level rotations and don't need bone-level transforms. Only add transforms for
 * specific legacy geometry IDs that are still actively used and have issues.
 *
 * Geometry format evolution:
 * - Legacy (v1.8 format): Uses bind_pose_rotation on bones, which affects child bones
 *   and requires Minecraft's renderer to apply hardcoded compensations
 * - Modern (v2/v3 format): Uses per-cube rotation, which doesn't affect bone hierarchy
 *   and renders correctly without special handling
 *
 * Entity geometry usage (as of Jan 2026):
 * - cow.entity.json uses geometry.cow.v2 (modern format, no transform needed)
 * - pig.entity.json uses geometry.pig.v3 (modern format, no transform needed)
 * - sheep.entity.json uses geometry.sheep.v1.8 (legacy format, but has bind_pose_rotation)
 * - cat.entity.json uses geometry.cat (legacy v1.21.0 format — body cube is modeled
 *   vertically [4,16,6] with NO rotation. Minecraft applies a hardcoded 90° X rotation.)
 * - wolf.entity.json uses geometry.wolf (legacy flat hierarchy — body and upperBody
 *   cubes modeled vertically, all bones root-level with no parent chain.)
 * - fox.entity.json uses geometry.fox (hierarchical — body cube [6,11,6] modeled
 *   vertically with children parented to body. Needs 90° X on body.)
 * - ocelot.entity.json uses geometry.ocelot.v1.8 (identical structure to geometry.cat.)
 * - chicken.entity.json uses geometry.chicken.v1.12 (modern, has per-cube rotation.)
 */
const VANILLA_GEOMETRY_TRANSFORMS: IVanillaGeometryTransform[] = [
  // ── Cat / Ocelot ──────────────────────────────────────────────────────
  // geometry.cat and geometry.ocelot.v1.8 model the body cube as a tall
  // vertical column [4,16,6] but Minecraft's engine hardcodes a 90° X
  // rotation on the body cube only (matching cow.v2's per-cube approach).
  //
  // Comparison with geometry.ocelot v1.0 (which has bind_pose_rotation):
  //   v1.0:  body pivot [0,12,-10], cube [-2,-7,-18], bind_pose_rotation [90,0,0]
  //   v1.8:  body pivot [0,7,1],    cube [-2,-1,-2],  NO rotation
  //
  // All child bones (head, legs, tail) already have correct world-space
  // positions — only the body cube needs rotation.  Tail cubes are vertical
  // at rest; the curve comes from animation, not static geometry.
  {
    geometryPatterns: ["geometry.cat", "geometry.ocelot.v1.8"],
    reason: "Body cube modeled vertically [4,16,6] — Minecraft hardcodes per-cube 90° X rotation (matches cow.v2 convention)",
    boneTransforms: [
      { boneName: "body", setCubeRotation: [90, 0, 0] },
    ],
  },
];

/**
 * Checks if a geometry identifier matches a pattern.
 * Supports simple wildcards: "*" matches any characters
 */
function matchesPattern(geometryId: string, pattern: string): boolean {
  // Normalize both to lowercase for comparison
  const normalizedId = geometryId.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  // Simple wildcard matching
  if (normalizedPattern.includes("*")) {
    // Convert pattern to regex: escape special regex characters, then replace * with .*
    // Must escape backslash first, then other special characters
    const regexPattern = normalizedPattern.replace(/\\/g, "\\\\").replace(/\./g, "\\.").replace(/\*/g, ".*");
    const regex = new RegExp("^" + regexPattern + "$");
    return regex.test(normalizedId);
  }

  return normalizedId === normalizedPattern;
}

/**
 * Finds the transform configuration for a given geometry identifier
 */
export function findGeometryTransform(geometryId: string): IVanillaGeometryTransform | undefined {
  for (const transform of VANILLA_GEOMETRY_TRANSFORMS) {
    for (const pattern of transform.geometryPatterns) {
      if (matchesPattern(geometryId, pattern)) {
        Log.verbose(`VanillaGeometryTransforms: Found transform for ${geometryId} (pattern: ${pattern})`);
        return transform;
      }
    }
  }
  return undefined;
}

/**
 * Applies transforms to a geometry definition.
 * Returns a deep copy with transforms applied - does not modify the original.
 *
 * @param geometry The original geometry definition
 * @param geometryId The geometry identifier (e.g., "geometry.cow.v1.8")
 * @returns A transformed copy of the geometry, or the original if no transforms apply
 */
export function applyGeometryTransforms(geometry: IGeometry, geometryId: string): IGeometry {
  const transformConfig = findGeometryTransform(geometryId);

  if (!transformConfig) {
    return geometry;
  }

  Log.verbose(`VanillaGeometryTransforms: Applying transforms to ${geometryId}: ${transformConfig.reason}`);

  // Deep clone the geometry to avoid modifying the original
  const transformed = JSON.parse(JSON.stringify(geometry)) as IGeometry;

  if (!transformed.bones) {
    return transformed;
  }

  // Apply each bone transform
  for (const boneTransform of transformConfig.boneTransforms) {
    for (const bone of transformed.bones) {
      // Check if this transform applies to this bone
      const matches = boneTransform.boneName === "*" || bone.name === boneTransform.boneName;

      if (!matches) {
        continue;
      }

      Log.verbose(`VanillaGeometryTransforms: Transforming bone "${bone.name}"`);

      // Apply bind_pose_rotation modifications
      if (boneTransform.setBindPoseRotation !== undefined) {
        bone.bind_pose_rotation = [...boneTransform.setBindPoseRotation];
        Log.verbose(`  - Set bind_pose_rotation to [${bone.bind_pose_rotation.join(", ")}]`);
      }

      if (boneTransform.addBindPoseRotation !== undefined) {
        const current = bone.bind_pose_rotation || [0, 0, 0];
        bone.bind_pose_rotation = [
          current[0] + boneTransform.addBindPoseRotation[0],
          current[1] + boneTransform.addBindPoseRotation[1],
          current[2] + boneTransform.addBindPoseRotation[2],
        ];
        Log.verbose(`  - Added to bind_pose_rotation, now [${bone.bind_pose_rotation.join(", ")}]`);
      }

      // Apply pivot modifications
      if (boneTransform.setPivot !== undefined) {
        bone.pivot = [...boneTransform.setPivot];
        Log.verbose(`  - Set pivot to [${bone.pivot.join(", ")}]`);
      }

      if (boneTransform.addPivotOffset !== undefined) {
        const current = bone.pivot || [0, 0, 0];
        bone.pivot = [
          current[0] + boneTransform.addPivotOffset[0],
          current[1] + boneTransform.addPivotOffset[1],
          current[2] + boneTransform.addPivotOffset[2],
        ];
        Log.verbose(`  - Added to pivot, now [${bone.pivot.join(", ")}]`);
      }

      // Apply cube origin offsets
      if (boneTransform.addCubeOriginOffset !== undefined && bone.cubes) {
        for (const cube of bone.cubes) {
          if (cube.origin) {
            cube.origin = [
              cube.origin[0] + boneTransform.addCubeOriginOffset[0],
              cube.origin[1] + boneTransform.addCubeOriginOffset[1],
              cube.origin[2] + boneTransform.addCubeOriginOffset[2],
            ];
          }
        }
        Log.verbose(`  - Added offset to ${bone.cubes.length} cube origins`);
      }

      // Apply per-cube rotation (rotates cube geometry only, not the bone TransformNode)
      if (boneTransform.setCubeRotation !== undefined && bone.cubes) {
        const bonePivot = bone.pivot || [0, 0, 0];
        for (const cube of bone.cubes) {
          cube.rotation = [...boneTransform.setCubeRotation];
          cube.pivot = [...bonePivot];
        }
        Log.verbose(`  - Set per-cube rotation [${boneTransform.setCubeRotation.join(", ")}] on ${bone.cubes.length} cubes (pivot: [${bonePivot.join(", ")}])`);
      }

      // Apply parent modifications
      if (boneTransform.removeParent) {
        delete bone.parent;
        Log.verbose(`  - Removed parent`);
      }

      if (boneTransform.setParent !== undefined) {
        if (boneTransform.setParent === null) {
          delete bone.parent;
        } else {
          bone.parent = boneTransform.setParent;
        }
        Log.verbose(`  - Set parent to "${bone.parent || "(none)"}"`);
      }
    }
  }

  return transformed;
}

/**
 * Returns a list of all registered geometry patterns that have transforms
 */
export function getRegisteredTransformPatterns(): string[] {
  const patterns: string[] = [];
  for (const transform of VANILLA_GEOMETRY_TRANSFORMS) {
    patterns.push(...transform.geometryPatterns);
  }
  return patterns;
}
