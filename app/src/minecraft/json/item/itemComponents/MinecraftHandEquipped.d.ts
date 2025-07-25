// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:hand_equipped
 * 
 * minecraft:hand_equipped Samples

AppleEnchanted - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/appleEnchanted.json

"minecraft:hand_equipped": false

Breeze Rod - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/breeze_rod.json

"minecraft:hand_equipped": true
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Hand Equipped (minecraft:hand_equipped)
 * The hand_equipped component determines if an item is rendered like
 * a tool while it is in a player's hand.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftHandEquipped {

  /**
   * @remarks
   * Determines whether the item is rendered like a tool while in
   * the player's hand.
   */
  value: boolean;

}