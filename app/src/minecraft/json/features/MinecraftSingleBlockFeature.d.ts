// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:single_block_feature
 * 
 * minecraft:single_block_feature Samples

Example - example

"minecraft:single_block_feature": {
  "format_version": "1.21.40",
  "minecraft:single_block_feature": {
    "description": {
      "identifier": "example:single_pumpkin_feature"
    },
    "places_block": [
      {
        "block": "minecraft:pumpkin",
        "weight": 5
      },
      {
        "block": "minecraft:carved_pumpkin",
        "weight": 1
      }
    ],
    "randomize_rotation": true,
    "enforce_survivability_rules": true,
    "enforce_placement_rules": true,
    "may_attach_to": {
      "auto_rotate": false,
      "min_sides_must_attach": 1,
      "south": [
        "minecraft:grass",
        "minecraft:dirt"
      ]
    },
    "may_not_attach_to": {
      "south": {
        "name": "minecraft:dirt",
        "states": {
          "dirt_type": "coarse"
        }
      }
    }
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Single Block Feature (minecraft:single_block_feature)
 * Places a single block in the world. The places_block field
 * supports a single block or a list of weighted blocks, where the
 * weight defines how likely it is for that block to be selected. The
 * may_attach_to and may_replace fields are allowlists which specify
 * where the block can be placed. If these fields are omitted, the
 * block can be placed anywhere. The may_not_attach_to field is a
 * denylist that specifies what blocks can't be close to the
 * placement location. The randomize_rotation field will randomize the
 * block's cardinal orientation. The block's internal survivability and
 * placement rules can optionally be enforced with the
 * enforce_survivability_rules and enforce_placement_rules fields.
 * These rules are specified per-block and are typically designed to
 * produce high quality gameplay or natural behavior. However, enabling
 * this enforcement may make it harder to debug placement failures.
 * Succeeds if the block is successfully placed in the world. Fails
 * if the block fails to be placed. Example use: Placing a single
 * pumpkin or carved pumpkin block where carved pumpkins are less
 * likely to appear.
 */
export default interface MinecraftSingleBlockFeature {

  description: MinecraftSingleBlockFeatureDescription;

  /**
   * @remarks
   * If true, enforce the block's canPlace check.
   */
  enforce_placement_rules: boolean;

  /**
   * @remarks
   * If true, enforce the block's canSurvive check.
   */
  enforce_survivability_rules: boolean;

  format_version?: string;

  /**
   * @remarks
   * Allowlist which specifies where the block can be placed.
   */
  may_attach_to?: MinecraftSingleBlockFeatureMayAttachTo;

  /**
   * @remarks
   * Denylist which specifies where the block can't be placed.
   */
  may_not_attach_to?: MinecraftSingleBlockFeatureMayNotAttachTo;

  may_replace?: string[];

  places_block?: MinecraftSingleBlockFeaturePlacesBlock[];

  /**
   * @remarks
   * If true, randomizes the block's cardinal orientation.
   */
  randomize_rotation?: boolean;

}


/**
 */
export interface MinecraftSingleBlockFeatureDescription {

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
export interface MinecraftSingleBlockFeatureMayAttachTo {

  all?: string[];

  /**
   * @remarks
   * Automatically rotate the block to attach sensibly. This setting is
   * ignored if 'randomize_rotation' is enabled.
   */
  auto_rotate?: boolean;

  bottom?: string[];

  diagonal?: string[];

  east?: string[];

  /**
   * @remarks
   * Number of side faces that need to pass the attach conditions before
   * the block can be placed. Default value is four.
   */
  min_sides_must_attach?: number;

  north?: string[];

  sides?: string[];

  south?: string[];

  top?: string[];

  west?: string[];

}


/**
 */
export interface MinecraftSingleBlockFeatureMayNotAttachTo {

  all?: string[];

  bottom?: string[];

  diagonal?: string[];

  east?: string[];

  north?: string[];

  sides?: string[];

  south?: string[];

  top?: string[];

  west?: string[];

}


/**
 */
export interface MinecraftSingleBlockFeaturePlacesBlock {

  /**
   * @remarks
   * Reference to the block to be placed.
   */
  block: object;

}