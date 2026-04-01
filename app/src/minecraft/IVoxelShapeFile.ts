// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Interface for a bounding box in a voxel shape.
 * Min and max can be arrays [x, y, z] or objects {x, y, z}.
 */
export interface IVoxelShapeBox {
  min: number[] | { x: number; y: number; z: number };
  max: number[] | { x: number; y: number; z: number };
}

/**
 * Interface for the shape definition containing boxes.
 */
export interface IVoxelShape {
  boxes: IVoxelShapeBox[];
}

/**
 * Interface for the description section.
 */
export interface IVoxelShapeDescription {
  identifier: string;
}

/**
 * Interface for the minecraft:voxel_shape wrapper.
 */
export interface IVoxelShapeWrapper {
  description: IVoxelShapeDescription;
  shape: IVoxelShape;
}

/**
 * Interface for the complete voxel shape file.
 */
export default interface IVoxelShapeFile {
  format_version: string;
  "minecraft:voxel_shape": IVoxelShapeWrapper;
}
