// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IModelGeometry {
  format_version: string;
  __comment__?: string;
  "minecraft:geometry": IGeometry[]; // note this is a 1.10.0+ definition thing
}

export interface IGeometry {
  description: IGeometryDescription;
  bones: IGeometryBone[];
  texturewidth?: number; // geometry 1.8.0 prop
  textureheight?: number; // geometry 1.8.0 prop
  visible_bounds_width?: number; // geometry 1.8.0 prop
  visible_bounds_height?: number; // geometry 1.8.0 prop
  visible_bounds_offset?: number[]; // geometry 1.8.0 prop
}

export interface IGeometryDescription {
  identifier: string;
  texture_width: number;
  texture_height: number;
  visible_bounds_width: number;
  visible_bounds_height: number;
  visible_bounds_offset: number[];
}

export interface IGeometryPolyMesh {
  normalized_uvs?: boolean;
  positions?: number[][]; // Array of [x, y, z] coordinates
  normals?: number[][]; // Array of [x, y, z] normal vectors
  uvs?: number[][]; // Array of [u, v] texture coordinates
  polys?: number[][][] | "tri_list" | "quad_list"; // Either array of polygons or string type
}

export interface IGeometryBone {
  name: string;
  pivot: number[];
  rotation?: number[];
  parent?: string;
  binding?: string;
  bind_pose_rotation?: number[];
  cubes?: IGeometryBoneCube[];
  locators?: { [name: string]: number[] };
  poly_mesh?: IGeometryPolyMesh; // Add this property
}

export interface IGeometryBoneCube {
  origin: number[] /* should be three elements*/;
  size: number[] /* should be three elements*/;
  uv: number[] /* should be two elements */ | IGeometryUVFaces;
  rotation?: number[] /* should be three elements*/;
  pivot?: number[] /* should be three elements*/;
  inflate?: number;
  mirror?: boolean;
}

export interface IGeometryUVFaces {
  north?: IGeometryUVFace;
  east?: IGeometryUVFace;
  south?: IGeometryUVFace;
  west?: IGeometryUVFace;
  up?: IGeometryUVFace;
  down?: IGeometryUVFace;
}

export interface IGeometryUVFace {
  uv: number[]; // should be 2 elements
  uv_size: number[]; // should be 2 elements
  uv_rotation?: number;
  material_instance?: string;
}
