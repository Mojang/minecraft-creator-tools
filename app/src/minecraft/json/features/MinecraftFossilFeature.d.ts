// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:fossil_feature
 * 
 * minecraft:fossil_feature Samples

Example - example

"minecraft:fossil_feature": {
  "format_version": "1.13.0",
  "minecraft:fossil_feature": {
    "description": {
      "identifier": "example:fossil_feature"
    },
    "ore_block": "minecraft:coal_ore",
    "max_empty_corners": 4
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Fossil Feature (minecraft:fossil_feature)
 * Generates a skeletal structure composed of bone blocks and
 * parametric ore blocks. Succeeds if the fossil is placed. Fails if
 * the fossil is not placed because it overlaps with another structure or
 * because its bounding box has too many corners occupied by air or
 * fluid.
 */
export default interface MinecraftFossilFeature {

  description: MinecraftFossilFeatureDescription;

  format_version?: string;

  max_empty_corners: number;

}


/**
 */
export interface MinecraftFossilFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}