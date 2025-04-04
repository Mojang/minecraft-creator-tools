// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:digger
 * 
 * minecraft:digger Samples
"minecraft:digger": {
  "minecraft:digger": {
    "use_efficiency": true,
    "destroy_speeds": [
      {
        "speed": 6,
        "block": {
          "tags": "query.any_tag( 'wood' )"
        }
      },
      {
        "block": "minecraft:coal_ore",
        "speed": 2
      }
    ]
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Digger (minecraft:digger)
 * Allows a creator to determine how quickly an item can dig
 * specific blocks.
 */
export default interface MinecraftDigger {

  /**
   * @remarks
   * A list of blocks to dig with correlating speeds of digging.
   */
  destroy_speeds: MinecraftDiggerDestroySpeeds[];

  /**
   * @remarks
   * Determines whether this item should be impacted if the
   * efficiency enchantment is applied to it.
   */
  use_efficiency: boolean;

}


/**
 * V1 20 50 DiggerItemComponent BlockInfo
 * V1 20 50 DiggerItemComponent BlockInfo.
 */
export interface MinecraftDiggerDestroySpeeds {

  /**
   * @remarks
   * Block to be dug.
   */
  block: MinecraftDiggerDestroySpeedsBlock;

  /**
   * @remarks
   * Digging speed for the correlating block(s).
   */
  speed: number;

}


/**
 * Block
 * Block
 */
export interface MinecraftDiggerDestroySpeedsBlock {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}