// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:underwater_cave_carver_feature
 * 
 * minecraft:underwater_cave_carver_feature Samples

Example - example

"minecraft:underwater_cave_carver_feature": {
  "format_version": "1.13.0",
  "minecraft:underwater_cave_carver_feature": {
    "description": {
      "identifier": "example:underground_cave_carver_feature"
    },
    "fill_with": "minecraft:water",
    "width_modifier": 0,
    "replace_air_with": "minecraft:flowing_water"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Underwater Cave Carver Feature
 * (minecraft:underwater_cave_carver_feature)
 * Carves a cave through the world in the current chunk, and in
 * every chunk around the current chunk in an 8-block radial pattern.
 * This feature will specifically target creating caves only below
 * sea level. This feature will only work when placed specifically in
 * the pass "pregeneration_pass".
 */
export default interface MinecraftUnderwaterCaveCarverFeature {

  description: MinecraftUnderwaterCaveCarverFeatureDescription;

  format_version: string;

  /**
   * @remarks
   * The height limit where we attempt to carve.
   */
  height_limit: number;

  /**
   * @remarks
   * The chance to skip doing the carve (1 / value).
   */
  skip_carve_chance: number;

  /**
   * @remarks
   * How many blocks to increase the cave radius by, from the center
   * point of the cave.
   */
  width_modifier: string;

}


/**
 */
export interface MinecraftUnderwaterCaveCarverFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}