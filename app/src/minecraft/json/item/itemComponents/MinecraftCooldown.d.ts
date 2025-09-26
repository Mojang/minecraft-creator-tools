// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:cooldown
 * 
 * minecraft:cooldown Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Cooldown (minecraft:cooldown)
 * After you use an item, all items with a "minecraft:cooldown" component
 * with the same "category" become unusable for the amount of
 * seconds specified in "duration".
 */
export default interface MinecraftCooldown {

  /**
   * @remarks
   * All items with the same "category" are put on cooldown when one
   * is used.
   */
  category: string;

  /**
   * @remarks
   * How long the item is on cooldown before being able to be used
   * again.
   */
  duration: number;

}