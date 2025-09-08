// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:digger
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Digger (minecraft:digger)
 * Digger item component specifies how quickly this item can dig
 * specific blocks.
 */
export default interface MinecraftDigger {

  /**
   * @remarks
   * A list of blocks to dig with correlating speeds of digging.
   */
  destroy_speeds?: MinecraftDiggerDestroySpeeds;

  /**
   * @remarks
   * Determines whether this item should be impacted if the
   * efficiency enchantment is applied to it.
   */
  use_efficiency?: boolean;

}


/**
 * Item Components BlockInfo (BlockInfo)
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
 * Block (block)
 */
export interface MinecraftDiggerDestroySpeedsBlock {

  name?: string;

  states?: number;

  tags?: string;

}