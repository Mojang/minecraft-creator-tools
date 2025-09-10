// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:ore_feature
 * 
 * minecraft:ore_feature Samples

Example - example

 * At Malachite ore in different materials: 
"minecraft:ore_feature": {
  "format_version": "1.13.0",
  "minecraft:ore_feature": {
    "description": {
      "identifier": "example:malachite_ore_feature"
    },
    "count": 12,
    "replace_rules": [
      {
        "places_block": "example:malachite_ore",
        "may_replace": [
          "minecraft:stone"
        ]
      },
      {
        "places_block": "example:granite_malachite_ore",
        "may_replace": [
          "minecraft:granite"
        ]
      },
      {
        "places_block": "example:andesite_malachite_ore",
        "may_replace": [
          "minecraft:andesite"
        ]
      }
    ]
  }
}

 * At Oil deposits in the sand: 
"minecraft:ore_feature": {
  "format_version": "1.13.0",
  "minecraft:ore_feature": {
    "description": {
      "identifier": "example:oil_deposit_feature"
    },
    "count": 12,
    "replace_rules": [
      {
        "places_block": "example:oil_block",
        "may_replace": [
          "minecraft:sand"
        ]
      }
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Ore Feature (minecraft:ore_feature)
 * Places a vein of blocks to simulate ore deposits. Despite the
 * name, any block can be placed by this feature. During placement,
 * existing world blocks are checked to see if they can be
 * replaced by the new ore block based on the list in the
 * may_replace field of a replace_rules entry. If no may_replace field
 * is specified, the ore block can replace any existing block.
 * Succeeds if at least one ore block is successfully placed. Fails
 * if all ore block placements fail.
 */
export default interface MinecraftOreFeature {

  /**
   * @remarks
   * The number of blocks to be placed.
   */
  count: number;

  description: MinecraftOreFeatureDescription;

  format_version?: string;

  replace_rules?: MinecraftOreFeatureReplaceRules[];

}


/**
 */
export interface MinecraftOreFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}


/**
 */
export interface MinecraftOreFeatureReplaceRules {

  may_replace?: string[];

}