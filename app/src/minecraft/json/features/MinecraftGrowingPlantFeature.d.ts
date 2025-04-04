// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:growing_plant_feature
 * 
 * minecraft:growing_plant_feature Samples

Example - example

"minecraft:growing_plant_feature": {
  "format_version": "1.13.0",
  "minecraft:growing_plant_feature": {
    "description": {
      "identifier": "example:cave_vine_feature"
    },
    "height_distribution": [
      [
        {
          "range_min": 1,
          "range_max": 13
        },
        2
      ],
      [
        {
          "range_min": 1,
          "range_max": 2
        },
        3
      ],
      [
        {
          "range_min": 1,
          "range_max": 7
        },
        10
      ]
    ],
    "growth_direction": "DOWN",
    "age": {
      "range_min": 17,
      "range_max": 26
    },
    "body_blocks": [
      [
        "minecraft:cave_vines",
        4
      ],
      [
        "minecraft:cave_vines_body_with_berries",
        1
      ]
    ],
    "head_blocks": [
      [
        "minecraft:cave_vines",
        4
      ],
      [
        "minecraft:cave_vines_head_with_berries",
        1
      ]
    ],
    "allow_water": true
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Growing Plant Feature (minecraft:growing_plant_feature)
 * Places a growing plant in the world. A growing plant is a
 * column that is anchored either to the ceiling or the floor, based
 * on its growth direction. The growing plant has a body and a
 * head, where the head is the tip of the plant, and the body
 * consists of the remaining blocks. This feature can be used to
 * define growing plants with variable body and head blocks, e.g.
 * Cave Vines.
 */
export default interface MinecraftGrowingPlantFeature {

  /**
   * @remarks
   * Plant blocks can be placed in water.
   */
  allow_water: boolean;

  body_blocks: string[];

  description: MinecraftGrowingPlantFeatureDescription;

  format_version: string;

  /**
   * @remarks
   * Direction that the plant grows towards. Valid values: UP and
   * DOWN
   */
  growth_direction: string;

  head_blocks: string[];

  height_distribution: string[];

}


/**
 */
export interface MinecraftGrowingPlantFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}