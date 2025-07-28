// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:stacked_by_data
 * 
 * minecraft:stacked_by_data Samples

AppleEnchanted - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/appleEnchanted.json

"minecraft:stacked_by_data": true
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Stacked By Data (minecraft:stacked_by_data)
 * The stacked_by_data component determines whether the same items
 * with different aux values can stack. Also defines whether the
 * item entities can merge while floating in the world.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftStackedByData {

  /**
   * @remarks
   * Determines whether the same item with different aux values can
   * stack. Also defines whether the item entities can merge while
   * floating in the world.
   */
  value: boolean;

}