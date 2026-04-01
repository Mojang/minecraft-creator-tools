// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ModelGeometryUtilities
 *
 * Shared utility methods for working with Minecraft Bedrock geometry models.
 * Contains static methods for:
 * - Cube bounding box calculations
 * - Bone transform accumulation
 * - Point rotation around pivots
 * - UV coordinate calculations
 * - Depth sorting for rendering
 * - Orthographic and isometric 2D projection
 *
 * These utilities are used by:
 * - ModelMeshFactory (3D BabylonJS rendering)
 * - Model2DRenderer (2D SVG rendering)
 * - BlockbenchModel (format conversion)
 *
 * COORDINATE SYSTEMS:
 * -------------------
 * Minecraft Bedrock Edition:
 *   - Right-handed coordinate system
 *   - +Y is up, +Z is forward (towards the viewer in default orientation), +X is right
 *   - Units are in 1/16ths of a block (so divide by 16 for block units)
 *
 * For 2D rendering (front view):
 *   - X maps to screen X (positive = right)
 *   - Y maps to screen Y (positive = up, but SVG Y is inverted)
 *   - Z is depth (positive = towards viewer, used for sorting)
 *
 * VIEW DIRECTIONS:
 * ----------------
 * Orthographic (axis-aligned, shows 1 face):
 *   - front, back, left, right, top, bottom
 *
 * Isometric (3D-like, shows 3 faces):
 *   - iso-front-right: north + east + up faces (classic Minecraft inventory style)
 *   - iso-front-left: north + west + up faces
 *   - iso-back-right: south + east + up faces
 *   - iso-back-left: south + west + up faces
 *
 * Last Updated: December 2025
 */

import { IGeometry, IGeometryBone, IGeometryBoneCube } from "./IModelGeometry";

/**
 * Represents accumulated bone transform including parent transforms
 */
export interface IBoneTransform {
  pivot: number[];
  rotation: number[]; // degrees [x, y, z]
  parentName?: string;
}

/**
 * Represents a projected 2D rectangle from a cube face
 */
export interface IProjectedFace {
  /** Screen X coordinate of bounding box top-left corner */
  x: number;
  /** Screen Y coordinate of bounding box top-left corner */
  y: number;
  /** Width in screen units (bounding box) */
  width: number;
  /** Height in screen units (bounding box) */
  height: number;
  /** Depth for z-ordering (larger = closer to viewer) - uses maxDepth by default for painter's algorithm */
  depth: number;
  /** Minimum depth (closest vertex to camera) */
  minDepth: number;
  /** Maximum depth (furthest vertex from camera) */
  maxDepth: number;
  /** Average depth across all vertices */
  avgDepth: number;
  /** Original cube reference */
  cube: IGeometryBoneCube;
  /** Bone that contains this cube */
  bone: IGeometryBone;
  /** Face name (north, south, east, west, up, down) */
  face: string;
  /** UV coordinates for texture sampling [u, v, width, height] */
  uv: number[];
  /**
   * Projected corner vertices for isometric views.
   * Order: bottom-left, bottom-right, top-right, top-left (counter-clockwise)
   * Each point is {x, y}. Present only for isometric projections.
   */
  vertices?: { x: number; y: number }[];
}

/**
 * Represents a 3D axis-aligned bounding box
 */
export interface IBoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/**
 * View direction for 2D projection.
 * Standard views: front, back, left, right, top, bottom (orthographic axis-aligned)
 * Isometric views: iso-front-right, iso-front-left, iso-back-right, iso-back-left
 *   These provide a 3D-like view showing 3 faces at once (classic Minecraft inventory style)
 */
export type ViewDirection =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "iso-front-right"
  | "iso-front-left"
  | "iso-back-right"
  | "iso-back-left";

/**
 * Check if a view direction is isometric (shows 3 faces at once)
 */
export function isIsometricView(direction: ViewDirection): boolean {
  return direction.startsWith("iso-");
}

export default class ModelGeometryUtilities {
  /**
   * Calculate the center point of a cube in world coordinates.
   * Cube origin is the minimum corner, so center = origin + size/2.
   */
  static getCubeCenter(cube: IGeometryBoneCube): number[] {
    const origin = cube.origin || [0, 0, 0];
    const size = cube.size || [0, 0, 0];
    return [origin[0] + size[0] / 2, origin[1] + size[1] / 2, origin[2] + size[2] / 2];
  }

  /**
   * Calculate the 8 corner vertices of a cube in world coordinates.
   * Returns array of [x, y, z] for each corner.
   */
  static getCubeVertices(cube: IGeometryBoneCube): number[][] {
    const origin = cube.origin || [0, 0, 0];
    const size = cube.size || [0, 0, 0];
    const inflate = cube.inflate || 0;

    const minX = origin[0] - inflate;
    const minY = origin[1] - inflate;
    const minZ = origin[2] - inflate;
    const maxX = origin[0] + size[0] + inflate;
    const maxY = origin[1] + size[1] + inflate;
    const maxZ = origin[2] + size[2] + inflate;

    return [
      [minX, minY, minZ],
      [maxX, minY, minZ],
      [minX, maxY, minZ],
      [maxX, maxY, minZ],
      [minX, minY, maxZ],
      [maxX, minY, maxZ],
      [minX, maxY, maxZ],
      [maxX, maxY, maxZ],
    ];
  }

  /**
   * Get the bounding box of a cube (axis-aligned, before rotation).
   */
  static getCubeBoundingBox(cube: IGeometryBoneCube): IBoundingBox {
    const origin = cube.origin || [0, 0, 0];
    const size = cube.size || [0, 0, 0];
    const inflate = cube.inflate || 0;

    return {
      minX: origin[0] - inflate,
      maxX: origin[0] + size[0] + inflate,
      minY: origin[1] - inflate,
      maxY: origin[1] + size[1] + inflate,
      minZ: origin[2] - inflate,
      maxZ: origin[2] + size[2] + inflate,
    };
  }

  /**
   * Get the bounding box of an entire geometry model.
   */
  static getGeometryBoundingBox(geometry: IGeometry): IBoundingBox {
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    if (!geometry.bones) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }

    // Build bone transforms for rotation handling
    const boneTransforms = this.buildBoneTransformMap(geometry);

    for (const bone of geometry.bones) {
      if (!bone.cubes) continue;

      for (const cube of bone.cubes) {
        // Get vertices and apply bone rotations
        const vertices = this.getCubeVertices(cube);
        const transform = boneTransforms.get(bone.name);

        for (let vertex of vertices) {
          // Apply cube rotation if present
          // Use same Babylon-style coordinate transformation as projectCubeFace
          if (cube.rotation && this.hasRotation(cube.rotation)) {
            const pivot = cube.pivot || this.getCubeCenter(cube);
            // Step 1: Calculate offset from pivot
            const offsetX = vertex[0] - pivot[0];
            const offsetY = vertex[1] - pivot[1];
            const offsetZ = vertex[2] - pivot[2];
            // Step 2: Convert to Babylon space (negate Z)
            const babylonOffset = [offsetX, offsetY, -offsetZ];
            // Step 3: Apply rotation with Y negated
            const adjustedRotation = [cube.rotation[0], -cube.rotation[1], cube.rotation[2]];
            const rotated = this.rotatePointAroundPivot(babylonOffset, [0, 0, 0], adjustedRotation);
            // Step 4: Convert back and add pivot
            vertex = [pivot[0] + rotated[0], pivot[1] + rotated[1], pivot[2] - rotated[2]];
          }

          // Apply bone rotation if present
          if (transform && this.hasRotation(transform.rotation)) {
            vertex = this.rotatePointAroundPivot(vertex, transform.pivot, transform.rotation);
          }

          // Apply parent bone rotations
          if (transform?.parentName) {
            let parentName: string | undefined = transform.parentName;
            while (parentName) {
              const parentTransform = boneTransforms.get(parentName);
              if (parentTransform && this.hasRotation(parentTransform.rotation)) {
                vertex = this.rotatePointAroundPivot(vertex, parentTransform.pivot, parentTransform.rotation);
              }
              parentName = parentTransform?.parentName;
            }
          }

          minX = Math.min(minX, vertex[0]);
          maxX = Math.max(maxX, vertex[0]);
          minY = Math.min(minY, vertex[1]);
          maxY = Math.max(maxY, vertex[1]);
          minZ = Math.min(minZ, vertex[2]);
          maxZ = Math.max(maxZ, vertex[2]);
        }
      }
    }

    // Handle case of no cubes
    if (minX === Infinity) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  /**
   * Check if a rotation array has any non-zero rotation.
   */
  static hasRotation(rotation: number[] | undefined): boolean {
    if (!rotation) return false;
    return rotation[0] !== 0 || rotation[1] !== 0 || rotation[2] !== 0;
  }

  /**
   * Build a map of bone transforms for a geometry.
   * Includes bind_pose_rotation and parent relationships.
   */
  static buildBoneTransformMap(geometry: IGeometry): Map<string, IBoneTransform> {
    const transforms = new Map<string, IBoneTransform>();

    if (!geometry.bones) return transforms;

    for (const bone of geometry.bones) {
      transforms.set(bone.name, {
        pivot: bone.pivot || [0, 0, 0],
        rotation: bone.bind_pose_rotation || bone.rotation || [0, 0, 0],
        parentName: bone.parent,
      });
    }

    return transforms;
  }

  /**
   * Rotate a point around a pivot by the given rotation (in degrees).
   * Applies rotations in Minecraft order: X, then Y, then Z.
   */
  static rotatePointAroundPivot(point: number[], pivot: number[], rotationDegrees: number[]): number[] {
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

  /**
   * Calculate the normal vector of a face from its rotated corner vertices.
   * Uses cross product of two edges to get the outward-facing normal.
   *
   * @param corners Array of 4 corner points [[x,y,z], ...] in counter-clockwise order
   * @returns Normalized face normal [nx, ny, nz]
   */
  static calculateFaceNormal(corners: number[][]): number[] {
    // Edge vectors: v1 = corner[1] - corner[0], v2 = corner[3] - corner[0]
    const v1 = [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]];

    const v2 = [corners[3][0] - corners[0][0], corners[3][1] - corners[0][1], corners[3][2] - corners[0][2]];

    // Cross product v2 × v1 gives outward-facing normal
    // (v1 × v2 would give inward-facing normal due to the corner winding order)
    const normal = [v2[1] * v1[2] - v2[2] * v1[1], v2[2] * v1[0] - v2[0] * v1[2], v2[0] * v1[1] - v2[1] * v1[0]];

    // Normalize
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
    if (length > 0) {
      normal[0] /= length;
      normal[1] /= length;
      normal[2] /= length;
    }

    return normal;
  }

  /**
   * Get the camera/view direction vector for a given view direction.
   * This is the direction FROM the camera TO the scene (opposite of camera facing).
   *
   * For orthographic/isometric rendering, we use a parallel projection, so
   * the view direction is constant (not dependent on position).
   */
  static getViewDirectionVector(viewDirection: ViewDirection): number[] {
    // These vectors point FROM the camera TOWARD the scene
    switch (viewDirection) {
      case "front":
        return [0, 0, 1]; // Looking from -Z toward +Z
      case "back":
        return [0, 0, -1]; // Looking from +Z toward -Z
      case "left":
        return [1, 0, 0]; // Looking from -X toward +X
      case "right":
        return [-1, 0, 0]; // Looking from +X toward -X
      case "top":
        return [0, -1, 0]; // Looking from +Y toward -Y
      case "bottom":
        return [0, 1, 0]; // Looking from -Y toward +Y
      // Isometric views: 45° Y rotation + ~30° X tilt
      // These are approximate normalized vectors
      case "iso-front-right": {
        // Camera sees: north (front), east (+X side), up (top)
        // East normal [1,0,0] must have dot < 0 → viewX must be negative
        const cos45 = 0.7071;
        const sin30 = 0.5;
        const cos30 = 0.866;
        return [-cos45 * cos30, -sin30, cos45 * cos30];
      }
      case "iso-front-left": {
        // Camera sees: north (front), west (-X side), up (top)
        // West normal [-1,0,0] must have dot < 0 → viewX must be positive
        const cos45 = 0.7071;
        const sin30 = 0.5;
        const cos30 = 0.866;
        return [cos45 * cos30, -sin30, cos45 * cos30];
      }
      case "iso-back-right": {
        // Camera sees: south (back), east (+X side), up (top)
        // East normal [1,0,0] must have dot < 0 → viewX must be negative
        const cos45 = 0.7071;
        const sin30 = 0.5;
        const cos30 = 0.866;
        return [-cos45 * cos30, -sin30, -cos45 * cos30];
      }
      case "iso-back-left": {
        // Camera sees: south (back), west (-X side), up (top)
        // West normal [-1,0,0] must have dot < 0 → viewX must be positive
        const cos45 = 0.7071;
        const sin30 = 0.5;
        const cos30 = 0.866;
        return [cos45 * cos30, -sin30, -cos45 * cos30];
      }
      default:
        return [0, 0, 1];
    }
  }

  /**
   * Check if a face should be visible (not backface-culled) given the view direction.
   *
   * @param faceNormal The normal vector of the face after rotations
   * @param viewDirection The current view direction
   * @returns true if the face is visible (facing the camera), false if backface-culled
   */
  static isFaceVisible(faceNormal: number[], viewDirection: ViewDirection): boolean {
    const viewVector = this.getViewDirectionVector(viewDirection);

    // Dot product of face normal and view direction
    // If positive, face normal points toward camera = visible
    // If negative, face normal points away from camera = backface, should be culled
    const dot = faceNormal[0] * viewVector[0] + faceNormal[1] * viewVector[1] + faceNormal[2] * viewVector[2];

    // Face is visible if its normal points somewhat toward the camera
    // Use a small negative threshold to handle near-perpendicular faces
    return dot < 0.01; // Normal points opposite to view direction = visible
  }

  /**
   * Calculate UV coordinates for a specific face of a cube.
   * Handles both legacy [u, v] format and per-face UV format.
   *
   * @returns [u, v, width, height] in texture pixels
   */
  static getCubeFaceUV(
    cube: IGeometryBoneCube,
    face: string,
    texWidth: number,
    texHeight: number
  ): { u: number; v: number; width: number; height: number } {
    const size = cube.size || [0, 0, 0];
    const w = size[0]; // width (X dimension)
    const h = size[1]; // height (Y dimension)
    const d = size[2]; // depth (Z dimension)

    if (Array.isArray(cube.uv) && cube.uv.length === 2) {
      // Legacy UV format - standard Minecraft box unwrap
      //            u    u+d  u+d+w u+d+w+d u+2d+2w
      //        v        +-----+----+
      //                 | Up  |Down|     <- Top row: height = d
      //      v+d   +----+-----+----+----+
      //            |East|North|West|South|  <- Bottom row: height = h
      //    v+d+h   +----+-----+----+----+
      //            | d  | w   | d  | w  |
      const u = cube.uv[0];
      const v = cube.uv[1];

      switch (face) {
        case "east":
          return { u: u, v: v + d, width: d, height: h };
        case "north":
          return { u: u + d, v: v + d, width: w, height: h };
        case "west":
          return { u: u + d + w, v: v + d, width: d, height: h };
        case "south":
          return { u: u + d + w + d, v: v + d, width: w, height: h };
        case "up":
          return { u: u + d, v: v, width: w, height: d };
        case "down":
          return { u: u + d + w, v: v, width: w, height: d };
        default:
          return { u: 0, v: 0, width: 1, height: 1 };
      }
    } else if (cube.uv && typeof cube.uv === "object") {
      // Per-face UV format
      const faceUV = (cube.uv as any)[face];
      if (faceUV && faceUV.uv && faceUV.uv_size) {
        return {
          u: faceUV.uv[0],
          v: faceUV.uv[1],
          width: Math.abs(faceUV.uv_size[0]),
          height: Math.abs(faceUV.uv_size[1]),
        };
      }
    }

    // Default - use full texture
    return { u: 0, v: 0, width: texWidth, height: texHeight };
  }

  /**
   * Get the faces that would be visible from a given view direction.
   * Returns the face names that should be rendered.
   *
   * In Minecraft, entities face north (-Z) by default. So:
   * - "front" view = looking at their face = we see the "north" face
   * - "back" view = looking at their back = we see the "south" face
   *
   * For isometric views, we see 3 faces at once:
   * - "iso-front-right" = north + east + up (viewing from the front-right above)
   * - "iso-front-left" = north + west + up (viewing from the front-left above)
   * - "iso-back-right" = south + east + up (viewing from the back-right above)
   * - "iso-back-left" = south + west + up (viewing from the back-left above)
   */
  static getVisibleFaces(viewDirection: ViewDirection): string[] {
    switch (viewDirection) {
      case "front":
        return ["north"]; // Entity faces north, so their front is the north face
      case "back":
        return ["south"]; // Entity's back is the south face
      case "left":
        return ["west"]; // Entity's left side (when they face north)
      case "right":
        return ["east"]; // Entity's right side (when they face north)
      case "top":
        return ["up"];
      case "bottom":
        return ["down"];
      // Isometric views show 3 faces
      case "iso-front-right":
        return ["north", "east", "up"];
      case "iso-front-left":
        return ["north", "west", "up"];
      case "iso-back-right":
        return ["south", "east", "up"];
      case "iso-back-left":
        return ["south", "west", "up"];
      default:
        return ["north"];
    }
  }

  /**
   * Get the secondary faces that would be partially visible from a given view.
   * Used for isometric or 3/4 view rendering with depth effects.
   * For isometric views, all 3 primary faces are already in getVisibleFaces, so no secondary.
   */
  static getSecondaryVisibleFaces(viewDirection: ViewDirection): string[] {
    switch (viewDirection) {
      case "front":
        return ["east", "west", "up"]; // Sides and top visible in 3/4 view
      case "back":
        return ["east", "west", "up"];
      case "left":
        return ["south", "north", "up"];
      case "right":
        return ["south", "north", "up"];
      case "top":
        return ["south", "east", "west", "north"];
      case "bottom":
        return ["south", "east", "west", "north"];
      // Isometric views already show all relevant faces in primary
      case "iso-front-right":
      case "iso-front-left":
      case "iso-back-right":
      case "iso-back-left":
        return [];
      default:
        return [];
    }
  }

  /**
   * Options for perspective projection in projectPoint.
   */
  static perspectiveOptions: {
    enabled: boolean;
    strength: number;
    focalLength: number;
    /** Reference depth - points at this depth have no perspective distortion */
    referenceDepth: number;
  } = {
    enabled: false,
    strength: 0,
    focalLength: 100,
    referenceDepth: 0,
  };

  /**
   * Center offset for isometric rotation.
   * When set, isometric rotation is applied around this center point instead of the world origin.
   * This ensures models with large Z offsets (like cow.v2) render correctly in isometric views.
   * Set to null to disable (rotate around world origin).
   */
  static isometricCenterOffset: number[] | null = null;

  /**
   * Apply isometric rotation to a 3D point.
   * For classic isometric view: rotate around Y-axis, then ~30° around X-axis.
   * This produces the familiar Minecraft inventory-style 3D view.
   *
   * Rotation angles for each view (entity faces north/-Z by default):
   *   - iso-front-right: -135° (see north + east + up)
   *   - iso-front-left: +135° (see north + west + up)
   *   - iso-back-right: -45° (see south + east + up)
   *   - iso-back-left: +45° (see south + west + up)
   *
   * @param point 3D point [x, y, z]
   * @param yRotation Y-axis rotation in degrees
   * @param centerOffset Optional 3D offset to subtract before rotation (for centering)
   * @returns Rotated point [x, y, z]
   */
  static applyIsometricRotation(point: number[], yRotation: number, centerOffset?: number[]): number[] {
    let [x, y, z] = point;

    // Store center offset for adding back after rotation
    const offsetX = centerOffset ? centerOffset[0] : 0;
    const offsetY = centerOffset ? centerOffset[1] : 0;
    const offsetZ = centerOffset ? centerOffset[2] : 0;

    // Translate to origin (so rotation happens around model center)
    x -= offsetX;
    y -= offsetY;
    z -= offsetZ;

    // Rotation angles:
    // - Y rotation: varies based on which corner we're viewing from
    // - X rotation: ~35.264° (arctan(1/√2)) for true isometric, or ~30° for a gentler view
    const yRad = (yRotation * Math.PI) / 180;
    const xRad = (30 * Math.PI) / 180; // 30 degrees tilt for a nice viewing angle

    // Apply Y rotation first (horizontal rotation around vertical axis)
    const cosY = Math.cos(yRad);
    const sinY = Math.sin(yRad);
    const newX = x * cosY + z * sinY;
    const newZ = -x * sinY + z * cosY;
    x = newX;
    z = newZ;

    // Apply X rotation (tilt toward viewer)
    const cosX = Math.cos(xRad);
    const sinX = Math.sin(xRad);
    const newY = y * cosX - z * sinX;
    const finalZ = y * sinX + z * cosX;
    y = newY;
    z = finalZ;

    // Translate back (keep model in original position after rotation)
    // For screen rendering, we typically want the rotated model centered at the
    // same screen position, so we add back the offset transformed to screen coords.
    // However, since we're doing orthographic projection after this, the X offset
    // should be added back to keep the model horizontally centered.
    // We DON'T add back Y and Z offsets since those affect screen Y and depth.
    // Actually, for proper centering, we need to think about what happens:
    // - The model was at center (X, Y, Z)
    // - We translated it to origin
    // - We rotated it
    // - Now we need it centered at (0, Y, 0) in screen space for proper display
    // Let's just not add anything back - the bounding box centering after projection
    // should handle the final centering in screen space.

    return [x, y, z];
  }

  /**
   * Project a 3D point to 2D screen coordinates.
   * When perspectiveOptions.enabled is true, applies perspective projection
   * so that points farther from the camera converge toward the center.
   *
   * @param point 3D point [x, y, z]
   * @param viewDirection View direction
   * @param scale Scale multiplier
   * @returns {x, y, depth} where x/y are screen coordinates and depth is for z-ordering
   */
  static projectPoint(
    point: number[],
    viewDirection: ViewDirection,
    scale: number = 1
  ): { x: number; y: number; depth: number } {
    let [x, y, z] = point;

    // Handle isometric views by first rotating the point
    // In Minecraft, entities face north (-Z). To see their front (north face) from the front-right,
    // we rotate the model so the north face is visible along with the east side.
    // Positive Y rotation = counterclockwise when viewed from above.
    // Use isometricCenterOffset to rotate around model center instead of world origin.
    const centerOffset = this.isometricCenterOffset;
    if (viewDirection === "iso-front-right") {
      // View from front-right: see north + east + up faces
      [x, y, z] = this.applyIsometricRotation(point, -135, centerOffset ?? undefined);
    } else if (viewDirection === "iso-front-left") {
      // View from front-left: see north + west + up faces
      [x, y, z] = this.applyIsometricRotation(point, 135, centerOffset ?? undefined);
    } else if (viewDirection === "iso-back-right") {
      // View from back-right: see south + east + up faces
      [x, y, z] = this.applyIsometricRotation(point, -45, centerOffset ?? undefined);
    } else if (viewDirection === "iso-back-left") {
      // View from back-left: see south + west + up faces
      [x, y, z] = this.applyIsometricRotation(point, 45, centerOffset ?? undefined);
    }

    // First, determine the depth axis value based on view direction
    // This is the axis pointing toward/away from camera
    let depthValue: number;
    let screenX: number;
    let screenY: number;

    // In Minecraft, entities face north (-Z) by default.
    // When looking at their "front", we look from -Z towards +Z to see their face.
    switch (viewDirection) {
      case "front":
        // Looking from -Z towards +Z (looking at entity's face)
        // X is mirrored (entity's left appears on our right), Y inverted for SVG
        depthValue = -z; // More negative Z = closer to camera = smaller depth value
        screenX = -x;
        screenY = -y;
        break;
      case "back":
        // Looking from +Z towards -Z (looking at entity's back)
        depthValue = z;
        screenX = x;
        screenY = -y;
        break;
      case "left":
        // Looking from -X towards +X (entity's left side when they face north)
        depthValue = -x;
        screenX = z;
        screenY = -y;
        break;
      case "right":
        // Looking from +X towards -X (entity's right side when they face north)
        depthValue = x;
        screenX = -z;
        screenY = -y;
        break;
      case "top":
        // Looking from +Y towards -Y
        depthValue = y;
        screenX = x;
        screenY = z;
        break;
      case "bottom":
        // Looking from -Y towards +Y
        depthValue = -y;
        screenX = x;
        screenY = -z;
        break;
      // Isometric views: after rotation, project orthographically along Z
      case "iso-front-right":
      case "iso-front-left":
      case "iso-back-right":
      case "iso-back-left":
        depthValue = z;
        screenX = x;
        screenY = -y;
        break;
      default:
        depthValue = z;
        screenX = x;
        screenY = -y;
        break;
    }

    // Apply perspective if enabled
    if (this.perspectiveOptions.enabled && this.perspectiveOptions.strength > 0) {
      const { strength, focalLength, referenceDepth } = this.perspectiveOptions;

      // Calculate relative depth from reference point
      // Points farther than reference (larger depth) will shrink toward center
      // Points closer than reference (smaller depth) will expand away from center
      const relativeDepth = depthValue - referenceDepth;

      // Perspective scale factor: closer objects are larger, farther objects smaller
      // focalLength / (focalLength + depth * strength)
      // When relativeDepth = 0, scaleFactor = 1 (no change)

      // When relativeDepth > 0 (farther), scaleFactor < 1 (smaller)
      // When relativeDepth < 0 (closer), scaleFactor > 1 (larger)
      const perspectiveScale = focalLength / (focalLength + relativeDepth * strength);

      screenX *= perspectiveScale;
      screenY *= perspectiveScale;
    }

    return { x: screenX * scale, y: screenY * scale, depth: depthValue };
  }

  /**
   * Get projected 2D rectangle for a cube face.
   * This is the core projection algorithm for 2D rendering.
   */
  static projectCubeFace(
    cube: IGeometryBoneCube,
    bone: IGeometryBone,
    face: string,
    viewDirection: ViewDirection,
    boneTransforms: Map<string, IBoneTransform>,
    scale: number = 1
  ): IProjectedFace | null {
    const origin = cube.origin || [0, 0, 0];
    const size = cube.size || [0, 0, 0];
    const inflate = cube.inflate || 0;

    // Get the four corners of the face in 3D
    let corners: number[][] = [];

    const minX = origin[0] - inflate;
    const minY = origin[1] - inflate;
    const minZ = origin[2] - inflate;
    const maxX = origin[0] + size[0] + inflate;
    const maxY = origin[1] + size[1] + inflate;
    const maxZ = origin[2] + size[2] + inflate;

    switch (face) {
      case "north": // -Z face
        corners = [
          [minX, minY, minZ],
          [maxX, minY, minZ],
          [maxX, maxY, minZ],
          [minX, maxY, minZ],
        ];
        break;
      case "south": // +Z face
        corners = [
          [maxX, minY, maxZ],
          [minX, minY, maxZ],
          [minX, maxY, maxZ],
          [maxX, maxY, maxZ],
        ];
        break;
      case "east": // +X face
        corners = [
          [maxX, minY, minZ],
          [maxX, minY, maxZ],
          [maxX, maxY, maxZ],
          [maxX, maxY, minZ],
        ];
        break;
      case "west": // -X face
        corners = [
          [minX, minY, maxZ],
          [minX, minY, minZ],
          [minX, maxY, minZ],
          [minX, maxY, maxZ],
        ];
        break;
      case "up": // +Y face
        corners = [
          [minX, maxY, minZ],
          [maxX, maxY, minZ],
          [maxX, maxY, maxZ],
          [minX, maxY, maxZ],
        ];
        break;
      case "down": // -Y face
        corners = [
          [minX, minY, maxZ],
          [maxX, minY, maxZ],
          [maxX, minY, minZ],
          [minX, minY, minZ],
        ];
        break;
      default:
        return null;
    }

    // Apply cube rotation if present
    // NOTE: Per-cube rotation requires matching Babylon.js coordinate handling exactly.
    // ModelMeshFactory applies cube rotation by:
    //   1. Creating a rotation node at the pivot with Z negated
    //   2. Positioning the mesh offset with Z negated  
    //   3. Applying rotation with X positive, Y negated, Z positive
    // To match this in 2D, we simulate the full coordinate transformation:
    if (cube.rotation && this.hasRotation(cube.rotation)) {
      const pivot = cube.pivot || this.getCubeCenter(cube);
      corners = corners.map((c) => {
        // Step 1: Calculate offset from pivot
        const offsetX = c[0] - pivot[0];
        const offsetY = c[1] - pivot[1];
        const offsetZ = c[2] - pivot[2];
        
        // Step 2: Convert offset to Babylon space (negate Z)
        const babylonOffset = [offsetX, offsetY, -offsetZ];
        
        // Step 3: Apply rotation with Y negated (as Babylon does)
        const adjustedRotation = [cube.rotation![0], -cube.rotation![1], cube.rotation![2]];
        const rotated = this.rotatePointAroundPivot(babylonOffset, [0, 0, 0], adjustedRotation);
        
        // Step 4: Convert back from Babylon space (negate Z again) and add pivot
        return [pivot[0] + rotated[0], pivot[1] + rotated[1], pivot[2] - rotated[2]];
      });
    }

    // Apply bone rotation if present
    const transform = boneTransforms.get(bone.name);
    if (transform && this.hasRotation(transform.rotation)) {
      corners = corners.map((c) => this.rotatePointAroundPivot(c, transform.pivot, transform.rotation));
    }

    // Apply parent bone rotations (walk up the hierarchy)
    if (transform?.parentName) {
      let parentName: string | undefined = transform.parentName;
      while (parentName) {
        const parentTransform = boneTransforms.get(parentName);
        if (parentTransform && this.hasRotation(parentTransform.rotation)) {
          corners = corners.map((c) => this.rotatePointAroundPivot(c, parentTransform.pivot, parentTransform.rotation));
        }
        parentName = parentTransform?.parentName;
      }
    }

    // Backface culling: calculate face normal and check if visible from view direction
    const faceNormal = this.calculateFaceNormal(corners);
    if (!this.isFaceVisible(faceNormal, viewDirection)) {
      return null; // Face is pointing away from camera, cull it
    }

    // Project corners to 2D
    const projected = corners.map((c) => this.projectPoint(c, viewDirection, scale));

    // Calculate bounding box in 2D
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const minProjX = Math.min(...xs);
    const maxProjX = Math.max(...xs);
    const minProjY = Math.min(...ys);
    const maxProjY = Math.max(...ys);

    // Calculate depth statistics for z-ordering
    const depths = projected.map((p) => p.depth);
    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);
    const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;

    // Store actual vertices for isometric rendering
    // Order: 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
    const vertices = projected.map((p) => ({ x: p.x, y: p.y }));

    return {
      x: minProjX,
      y: minProjY,
      width: maxProjX - minProjX,
      height: maxProjY - minProjY,
      // Use avgDepth for z-ordering (painter's algorithm)
      // minDepth and maxDepth are available for more sophisticated sorting if needed
      depth: avgDepth,
      minDepth,
      maxDepth,
      avgDepth,
      cube,
      bone,
      face,
      uv: [0, 0, size[0], size[1]], // Will be filled in by UV calculation
      vertices,
    };
  }

  /**
   * Get all visible faces from a geometry for a given view direction.
   * Sorted by depth (back to front) for proper occlusion.
   */
  static getProjectedFaces(
    geometry: IGeometry,
    viewDirection: ViewDirection,
    scale: number = 1,
    includeSecondary: boolean = false
  ): IProjectedFace[] {
    const faces: IProjectedFace[] = [];
    const boneTransforms = this.buildBoneTransformMap(geometry);

    // For isometric views with rotated cubes, we need to try all 6 faces
    // and let backface culling determine which are actually visible.
    // For orthographic views, we can optimize by pre-selecting likely faces.
    const isIsometric =
      viewDirection === "iso-front-right" ||
      viewDirection === "iso-front-left" ||
      viewDirection === "iso-back-right" ||
      viewDirection === "iso-back-left";

    // All possible faces - for isometric we try all, for ortho we pre-select
    const allPossibleFaces = ["north", "south", "east", "west", "up", "down"];
    const visibleFaceNames = this.getVisibleFaces(viewDirection);
    const secondaryFaceNames = includeSecondary ? this.getSecondaryVisibleFaces(viewDirection) : [];

    // For isometric views, try all 6 faces to handle rotated cubes correctly
    // Backface culling in projectCubeFace will filter out invisible faces
    const facesToTry = isIsometric ? allPossibleFaces : [...visibleFaceNames, ...secondaryFaceNames];

    if (!geometry.bones) return faces;

    // For isometric views, calculate the model center to use as rotation pivot
    // This ensures models with large Z offsets render correctly centered
    if (isIsometric) {
      const bounds = this.getGeometryBoundingBox(geometry);
      this.isometricCenterOffset = [
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
        (bounds.minZ + bounds.maxZ) / 2,
      ];
    } else {
      this.isometricCenterOffset = null;
    }

    for (const bone of geometry.bones) {
      if (!bone.cubes) continue;

      for (const cube of bone.cubes) {
        for (const faceName of facesToTry) {
          const projected = this.projectCubeFace(cube, bone, faceName, viewDirection, boneTransforms, scale);
          if (projected && projected.width > 0 && projected.height > 0) {
            faces.push(projected);
          }
        }
      }
    }

    // Reset isometric center offset after projection
    this.isometricCenterOffset = null;

    // Calculate bone hierarchy depth for each face to help with sorting ties
    const boneHierarchyDepth = new Map<string, number>();
    if (geometry.bones) {
      for (const bone of geometry.bones) {
        let depth = 0;
        let parentName = bone.parent;
        while (parentName) {
          depth++;
          const parentBone = geometry.bones.find((b) => b.name === parentName);
          parentName = parentBone?.parent;
        }
        boneHierarchyDepth.set(bone.name, depth);
      }
    }

    // Sort by depth (back to front - smaller depth values first)
    // Use a weighted depth that considers both min and max to handle rotated faces better.
    // For faces with wide depth ranges (like 90° rotated cubes), use max depth to ensure
    // they're drawn after faces that are entirely behind them.
    faces.sort((a, b) => {
      // Calculate depth range for each face
      const aRange = a.maxDepth - a.minDepth;
      const bRange = b.maxDepth - b.minDepth;

      // For faces with narrow depth range, use avgDepth
      // For faces with wide depth range (rotated), bias toward maxDepth
      const aWeight = aRange > 5 ? 0.8 : 0.5; // Bias more toward max for wide ranges
      const bWeight = bRange > 5 ? 0.8 : 0.5;
      const aDepth = a.minDepth * (1 - aWeight) + a.maxDepth * aWeight;
      const bDepth = b.minDepth * (1 - bWeight) + b.maxDepth * bWeight;

      const depthDiff = aDepth - bDepth;
      if (Math.abs(depthDiff) > 0.5) {
        return depthDiff;
      }

      // For similar depths, sort by bone hierarchy (parents first)
      const aHierarchy = boneHierarchyDepth.get(a.bone.name) || 0;
      const bHierarchy = boneHierarchyDepth.get(b.bone.name) || 0;
      if (aHierarchy !== bHierarchy) {
        return aHierarchy - bHierarchy;
      }

      return depthDiff;
    });

    return faces;
  }

  /**
   * Calculate the normalized UV coordinates for a face.
   * Returns coordinates in range [0, 1].
   */
  static getNormalizedUV(
    u: number,
    v: number,
    width: number,
    height: number,
    texWidth: number,
    texHeight: number
  ): { uMin: number; vMin: number; uMax: number; vMax: number } {
    return {
      uMin: u / texWidth,
      vMin: v / texHeight,
      uMax: (u + width) / texWidth,
      vMax: (v + height) / texHeight,
    };
  }
}
