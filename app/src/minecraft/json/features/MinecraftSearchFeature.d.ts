// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:search_feature
 * 
 * minecraft:search_feature Samples

Example - example

"minecraft:search_feature": {
  "format_version": "1.13.0",
  "minecraft:search_feature": {
    "description": {
      "identifier": "example:find_valid_apples_feature"
    },
    "places_feature": "example:apple_feature",
    "search_volume": {
      "min": [
        -3,
        -3,
        -3
      ],
      "max": [
        3,
        3,
        3
      ]
    },
    "search_axis": "-y",
    "required_successes": 3
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Search Feature (minecraft:search_feature)
 * Sweeps a volume searching for a valid placement location for its
 * referenced feature. The search_volume field specifies the
 * axis-aligned bounding box that defines the boundaries of the
 * search. The search sweeps along the axis defined by the
 * search_axis field, layer by layer. For example, if search_axis is
 * set to -x, blocks with greater x values will be checked before
 * blocks with lower x values. Each layer is searched from the
 * bottom-left to the top-right before moving to the next layer along
 * the axis. By default, only one valid position must be found, but
 * this can be altered by specifying the required_successes field. If
 * fewer than the required successes are found, no placement will
 * occur. Succeeds if the number of valid positions is equal to
 * the value specified by required_successes. Fails if the number of
 * valid positions is less than the value specified by
 * required_successes.
 */
export default interface MinecraftSearchFeature {

  description: MinecraftSearchFeatureDescription;

  format_version: string;

  /**
   * @remarks
   * Number of valid positions the search must find in order to
   * place the referenced feature
   */
  required_successes: number;

  /**
   * @remarks
   * Axis that the search will sweep along through the
   * 'search_volume'
   */
  search_axisLessThanxPlusxyPlusyzPlusz: string;

  /**
   * @remarks
   * Axis-aligned bounding box that will be searched for valid
   * placement positions. Expressed as offsets from the input 
   * position.
   */
  search_volume: MinecraftSearchFeatureSearchVolume;

}


/**
 */
export interface MinecraftSearchFeatureDescription {

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
export interface MinecraftSearchFeatureSearchVolume {

  /**
   * @remarks
   * x_min
   */
  _00: number;

  /**
   * @remarks
   * y_min
   */
  _11: number;

  /**
   * @remarks
   * z_min
   */
  _22: number;

  /**
   * @remarks
   * Maxium extent of the bounding volume expressed as [ x, y, z 
   * ]
   */
  max: string[];

  /**
   * @remarks
   * Minimum extent of the bounding volume expressed as [ x, y, z 
   * ]
   */
  min: string[];

}