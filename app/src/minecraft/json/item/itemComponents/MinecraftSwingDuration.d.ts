// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:swing_duration
 * 
 * minecraft:swing_duration Samples

Copper Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/copper_spear.json

"minecraft:swing_duration": {
  "value": 0.85
}


Diamond Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/diamond_spear.json

"minecraft:swing_duration": {
  "value": 1.05
}


Golden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/golden_spear.json

"minecraft:swing_duration": {
  "value": 0.95
}


Netherite Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/netherite_spear.json

"minecraft:swing_duration": {
  "value": 1.15
}


Stone Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/stone_spear.json

"minecraft:swing_duration": {
  "value": 0.75
}


Wooden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wooden_spear.json

"minecraft:swing_duration": {
  "value": 0.65
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Swing Duration (minecraft:swing_duration)
 * Duration, in seconds, of the item's swing animation played when
 * mining or attacking. Affects visuals only and does not impact
 * attack frequency or other gameplay mechanics.
 */
export default interface MinecraftSwingDuration {

  /**
   * @remarks
   * Duration, in seconds, of the item's swing animation played when
   * mining or attacking. Affects visuals only and does not impact
   * attack frequency or other gameplay mechanics.
   * 
   * Sample Values:
   * Copper Spear: 0.85
   *
   * Diamond Spear: 1.05
   *
   * Golden Spear: 0.95
   *
   */
  value?: number;

}