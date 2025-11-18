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

  debug?: boolean;

  format_version: string | number[];

  "geometryazAZ09_:": GeometryGeometryazAZ09;

}


/**
 */
export interface GeometryGeometryazAZ09 {

  bones?: GeometryGeometryazAZ09Bones[];

  cape?: string;

  debug?: boolean;

  textureheight?: number;

  texturewidth?: number;

  visible_bounds_offset?: string[];

}


/**
 */
export interface GeometryGeometryazAZ09Bones {

  bind_pose_rotation?: string[];

  cubes?: GeometryGeometryazAZ09BonesCubes[];

  debug?: boolean;

  locators?: { [key: string]: any };

  mirror?: boolean;

  name: string;

  neverRender?: boolean;

  parent?: string;

  pivot?: string[];

  poly_mesh?: { [key: string]: any };

  render_group_id?: number;

  reset?: boolean;

  rotation?: string[];

  texture_meshes?: GeometryGeometryazAZ09BonesTextureMeshes[];

}


/**
 */
export interface GeometryGeometryazAZ09BonesCubes {

  mirror?: boolean;

  origin?: string[];

  size?: string[];

  uv?: string[];

}


/**
 */
export interface GeometryGeometryazAZ09BonesLocators {

}


/**
 */
export interface GeometryGeometryazAZ09BonesPolyMesh {

  normalized_uvs?: boolean;

  normals?: string[];

  polys: string[];

  positions?: string[];

  uvs?: string[];

}


/**
 */
export interface GeometryGeometryazAZ09BonesTextureMeshes {

  local_pivot?: string[];

  position?: string[];

  rotation?: string[];

  scale?: string[];

  texture: string;

  use_pixel_depth?: boolean;

}