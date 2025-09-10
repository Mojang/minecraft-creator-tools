// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:cave_carver_feature
 * 
 * minecraft:cave_carver_feature Samples

Example - example

"minecraft:cave_carver_feature": {
  "format_version": "1.13.0",
  "minecraft:cave_carver_feature": {
    "description": {
      "identifier": "example:underground_cave_carver_feature"
    },
    "fill_with": "minecraft:air",
    "width_modifier": 0,
    "skip_carve_chance": 15
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Cave Carver Feature (minecraft:cave_carver_feature)
 * Carves a cave through the world in the current chunk, and in
 * every chunk around the current chunk in an 8 radial pattern. This
 * feature only works when placed in the pass 
 * "pregeneration_pass".
 */
export default interface MinecraftCaveCarverFeature {

  description: MinecraftCaveCarverFeatureDescription;

  format_version?: string;

  /**
   * @remarks
   * The height limit where we attempt to carve.
   */
  height_limit?: number;

  /**
   * @remarks
   * The chance to skip doing the carve (1 / value).
   */
  skip_carve_chance?: number;

  /**
   * @remarks
   * How many blocks to increase the cave radius by, from the center
   * point of the cave.
   */
  width_modifier?: string;

}


/**
 */
export interface MinecraftCaveCarverFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}