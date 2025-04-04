// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:weighted_random_feature
 * 
 * minecraft:weighted_random_feature Samples

Example - example

"minecraft:weighted_random_feature": {
  "format_version": "1.13.0",
  "minecraft:weighted_random_feature": {
    "description": {
      "identifier": "example:select_flower_feature"
    },
    "features": [
      [
        "example:white_flower_feature",
        1
      ],
      [
        "example:red_flower_feature",
        2
      ],
      [
        "example:blue_flower_feature",
        1
      ],
      [
        "example:yellow_flower_feature",
        4
      ]
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Weighted Random Feature (minecraft:weighted_random_feature)
 */
export default interface MinecraftWeightedRandomFeature {

  description: MinecraftWeightedRandomFeatureDescription;

  features: string[];

  format_version: string;

}


/**
 */
export interface MinecraftWeightedRandomFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}