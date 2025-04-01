// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Visuals Documentation - minecraft:geometry.v1.8.0
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface Geometry {

  debug: boolean;

  format_version: string | number[];

  "geometryazAZ09_:Plus": GeometryGeometryazAZ09Plus;

}


/**
 */
export interface GeometryGeometryazAZ09Plus {

  bones: GeometryGeometryazAZ09PlusBones[];

  cape: string;

  debug: boolean;

  textureheight: number;

  texturewidth: number;

  visible_bounds_offset: string[];

}


/**
 */
export interface GeometryGeometryazAZ09PlusBones {

  bind_pose_rotation: string[];

  cubes: GeometryGeometryazAZ09PlusBonesCubes[];

  debug: boolean;

  locators: { [key: string]: any };

  mirror: boolean;

  name: string;

  neverRender: boolean;

  parent: string;

  pivot: string[];

  poly_mesh: { [key: string]: any };

  render_group_id: number;

  reset: boolean;

  rotation: string[];

  texture_meshes: GeometryGeometryazAZ09PlusBonesTextureMeshes[];

}


/**
 */
export interface GeometryGeometryazAZ09PlusBonesCubes {

  mirror: boolean;

  origin: string[];

  size: string[];

  uv: string[];

}


/**
 */
export interface GeometryGeometryazAZ09PlusBonesLocators {

}


/**
 */
export interface GeometryGeometryazAZ09PlusBonesPolyMesh {

  normalized_uvs: boolean;

  normals: string[];

  polys: string[];

  positions: string[];

  uvs: string[];

}


/**
 */
export interface GeometryGeometryazAZ09PlusBonesTextureMeshes {

  local_pivot: string[];

  position: string[];

  rotation: string[];

  scale: string[];

  texture: string;

}