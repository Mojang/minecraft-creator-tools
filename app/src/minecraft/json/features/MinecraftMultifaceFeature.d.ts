// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:multiface_feature
 * 
 * minecraft:multiface_feature Samples

Example - example

"minecraft:multiface_feature": {
  "format_version": "1.13.0",
  "minecraft:multiface_feature": {
    "description": {
      "identifier": "example:blue_vines_feature"
    },
    "places_block": "example:blue_vine",
    "search_range": 64,
    "can_place_on_floor": true,
    "can_place_on_ceiling": true,
    "can_place_on_wall": true,
    "chance_of_spreading": 0.5,
    "can_place_on": [
      "minecraft:stone"
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Multiface Feature (minecraft:multiface_feature)
 * Places multiface blocks on floors/walls/ceilings. Despite the
 * name, any block can be placed by this feature. During placement,
 * existing world blocks are checked to see if this feature can be
 * applied to them based on the list in the can_place_on field. If
 * no can_replace_on field is specified, the place_block block can
 * be placed on any existing block. This feature will also try to
 * spread the place_block block around the location the feature is
 * placed. Succeeds if: At least one block is successfully placed.
 * Fails if ll block placements fail.
 */
export default interface MinecraftMultifaceFeature {

  can_place_on?: string[];

  /**
   * @remarks
   * Can this feature be placed on the ceiling (bottom face of a
   * block)?
   */
  can_place_on_ceiling: boolean;

  /**
   * @remarks
   * Can this feature be placed on the ground (top face of a
   * block)?
   */
  can_place_on_floor: boolean;

  /**
   * @remarks
   * Can this feature be placed on the wall (side faces of a
   * block)?
   */
  can_place_on_wall: boolean;

  description: MinecraftMultifaceFeatureDescription;

  format_version?: string;

  /**
   * @remarks
   * How far, in blocks, this feature can search for a valid position to
   * place.
   */
  search_range: number;

}


/**
 */
export interface MinecraftMultifaceFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}