// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:fuel
 * 
 * minecraft:fuel Samples

My Sword Chuck - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_chuck.json

"minecraft:fuel": {
  "duration": 3
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Fuel (minecraft:fuel)
 * Allows this item to be used as fuel in a furnace to 'cook' other
 * items.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Decimal number`.

 */
export default interface MinecraftFuel {

  /**
   * @remarks
   * How long in seconds will this fuel cook items for.
   * 
   * Sample Values:
   * My Sword Chuck: 3
   *
   *
   */
  duration: number;

}