// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:vegetation_patch_feature
 * 
 * minecraft:vegetation_patch_feature Samples

Example - example

"minecraft:vegetation_patch_feature": {
  "format_version": "1.13.0",
  "minecraft:vegetation_patch_feature": {
    "description": {
      "identifier": "example:clay_pool_with_dripleaves_feature"
    },
    "replaceable_blocks": [
      "minecraft:clay",
      "minecraft:moss_block",
      "minecraft:sand",
      "minecraft:gravel",
      "minecraft:dirt",
      "minecraft:coarse_dirt",
      "minecraft:podzol",
      "minecraft:dirt_with_roots",
      "minecraft:grass_block",
      "minecraft:mycelium",
      "minecraft:stone",
      "minecraft:cave_vines",
      "minecraft:cave_vines_body_with_berries",
      "minecraft:cave_vines_head_with_berries"
    ],
    "ground_block": "minecraft:clay",
    "vegetation_feature": "minecraft:dripleaf_feature",
    "surface": "floor",
    "depth": 3,
    "vertical_range": 5,
    "vegetation_chance": 0.1,
    "horizontal_radius": {
      "range_min": 4,
      "range_max": 8
    },
    "extra_deep_block_chance": 0.8,
    "extra_edge_column_chance": 0.7,
    "waterlogged": true
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Vegetation Patch Feature 
 * (minecraft:vegetation_patch_feature)
 * Scatters vegetation in an area. The vegetation feature's appearance can
 * be modified by adjusting the radius and depth that it will
 * generate.
 */
export default interface MinecraftVegetationPatchFeature {

  description: MinecraftVegetationPatchFeatureDescription;

  format_version?: string;

  replaceable_blocks: string[];

  /**
   * @remarks
   * Determines if a vegetation patch will grow from the ceiling or
   * the floor.
   */
  surface?: string;

  /**
   * @remarks
   * Vertical range used to determine a suitable surface position for
   * the patch.
   */
  vertical_range: number;

  /**
   * @remarks
   * If true, waterlogs the positions occupied by the ground 
   * blocks.
   */
  waterlogged?: boolean;

}


/**
 */
export interface MinecraftVegetationPatchFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}