// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:boostable
 * 
 * minecraft:boostable Samples

Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

"minecraft:boostable": {
  "speed_multiplier": 1.35,
  "duration": 3,
  "boost_items": [
    {
      "item": "carrotOnAStick",
      "damage": 2,
      "replace_item": "fishing_rod"
    }
  ]
}


Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

"minecraft:boostable": {
  "speed_multiplier": 1.35,
  "duration": 16,
  "boost_items": [
    {
      "item": "warped_fungus_on_a_stick",
      "damage": 1,
      "replace_item": "fishing_rod"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Boostable (minecraft:boostable)
 * Defines the conditions and behavior of a rideable entity's 
 * boost.
 */
export default interface MinecraftBoostable {

  /**
   * @remarks
   * List of items that can be used to boost while riding this 
   * entity.
   * 
   * Sample Values:
   * Pig: [{"item":"carrotOnAStick","damage":2,"replace_item":"fishing_rod"}]
   *
   */
  boost_items?: MinecraftBoostableBoostItems;

  /**
   * @remarks
   * Time in seconds for the boost.
   */
  duration?: number;

  /**
   * @remarks
   * Factor by which the entity's normal speed increases. E.g. 2.0
   * means go twice as fast.
   */
  speed_multiplier?: number;

}


/**
 * List of items that can be used to boost while riding this entity.
 * Each item has the following properties:
 */
export interface MinecraftBoostableBoostItems {

  /**
   * @remarks
   * This is the damage that the item will take each time it is
   * used.
   */
  damage?: string[];

  /**
   * @remarks
   * Name of the item that can be used to boost.
   */
  item?: string;

  /**
   * @remarks
   * The item used to boost will become this item once it is used 
   * up.
   */
  replace_item?: string;

}