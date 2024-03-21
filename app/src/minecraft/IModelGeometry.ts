// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IModelGeometry {
  format_version: string;
  __comment__?: string;
  "minecraft:geometry": IGeometry[];
}

export interface IGeometry {
  description: IGeometryDescription;
  bones: IGeometryBone[];
}

export interface IGeometryDescription {
  identifier: string;
  texture_width: number;
  texture_height: number;
  visible_bounds_width: number;
  visible_bounds_height: number;
  visible_bounds_offset: number[];
}

export interface IGeometryBone {
  name: string;
  pivot: number[];
  cubes: IGeometryBoneCubes[];
  locators: { [name: string]: number[] };
}

export interface IGeometryBoneCubes {
  origin: number[];
  size: number[];
  uv: number[];
}
