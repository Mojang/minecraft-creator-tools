// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:geode_feature
 * 
 * minecraft:geode_feature Samples

Example - example

"minecraft:geode_feature": {
  "format_version": "1.13.0",
  "minecraft:geode_feature": {
    "description": {
      "identifier": "minecraft:diamond_geode_feature"
    },
    "filler": "minecraft:air",
    "inner_layer": "minecraft:diamond_block",
    "alternate_inner_layer": "minecraft:emerald_block",
    "middle_layer": "minecraft:calcite",
    "outer_layer": "minecraft:obsidian",
    "inner_placements": [
      {
        "name": "minecraft:amethyst_cluster",
        "states": {
          "amethyst_cluster_type": "small"
        }
      }
    ],
    "min_outer_wall_distance": 4,
    "max_outer_wall_distance": 7,
    "min_distribution_points": 3,
    "max_distribution_points": 5,
    "min_point_offset": 1,
    "max_point_offset": 3,
    "max_radius": 16,
    "crack_point_offset": 2,
    "generate_crack_chance": 0.95,
    "base_crack_size": 2,
    "noise_multiplier": 0.025,
    "use_potential_placements_chance": 0.35,
    "use_alternate_layer0_chance": 0.083,
    "placements_require_layer0_alternate": true,
    "invalid_blocks_threshold": 1
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Geode Feature (minecraft:geode_feature)
 * Generates a rock formation to simulate a geode. Each layer of,
 * and block within, the geode can be replaced. Succeeds if at
 * least one block within the geode is placed. Fails if all blocks
 * within the geode fail to be placed.
 */
export default interface MinecraftGeodeFeature {

  /**
   * @remarks
   * An offset applied to each distribution point that forms the
   * geode crack opening. [0,10]
   */
  crack_point_offset: number;

  description: MinecraftGeodeFeatureDescription;

  format_version?: string;

  inner_placements?: string[];

  /**
   * @remarks
   * The threshold of invalid blocks for a geode to have a
   * distribution point in before it aborts generation entirely.
   */
  invalid_blocks_threshold: number;

  /**
   * @remarks
   * The maximum number of points inside the distance field that can
   * get generated. The distance field is the area consisting of all
   * points with a minimum distance to all destribution points. 
   * [0,20]
   */
  max_distribution_points: number;

  /**
   * @remarks
   * The maximum distance each distribution point can be from the
   * outer wall. [0,20]
   */
  max_outer_wall_distance: number;

  /**
   * @remarks
   * The highest possible value of random offset applied to the
   * position of each distribution point. [0,10]
   */
  max_point_offset: number;

  /**
   * @remarks
   * The maximum possible radius of the geode generated.
   */
  max_radius: number;

  /**
   * @remarks
   * The minimum number of points inside the distance field that can
   * get generated. The distance field is the area consisting of all
   * points with a minimum distance to all destribution points. 
   * [0,10]
   */
  min_distribution_points: number;

  /**
   * @remarks
   * The minimum distance each distribution point must be from the
   * outer wall. [0,10]
   */
  min_outer_wall_distance: number;

  /**
   * @remarks
   * The lowest possible value of random offset applied to the
   * position of each distribution point. [0,10]
   */
  min_point_offset: number;

  /**
   * @remarks
   * If true, the potential placement block will only be placed on
   * the alternate layer0 blocks that get placed. Potential placement
   * blocks are blocks that depend on the existance of another block to
   * be placed. The latter are the layer0 alternate blocks.
   */
  placements_require_layer0_alternate: boolean;

}


/**
 */
export interface MinecraftGeodeFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}