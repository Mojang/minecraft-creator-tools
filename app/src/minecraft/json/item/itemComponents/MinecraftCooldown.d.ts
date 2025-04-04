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
"minecraft:cooldown": {
  "category": "attack",
  "duration": 0.2
}


Wind Charge - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wind_charge.json

"minecraft:cooldown": {
  "category": "wind_charge",
  "duration": 0.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Cooldown (minecraft:cooldown)
 * The duration of time (in seconds) items with a matching category will
 * spend cooling down before becoming usable again.
 */
export default interface MinecraftCooldown {

  /**
   * @remarks
   * The type of cool down for this item. All items with a cool down
   * component with the same category are put on cool down when one
   * is used.
   * 
   * Sample Values:
   * Wind Charge: "wind_charge"
   *
   */
  category: string;

  /**
   * @remarks
   * The duration of time (in seconds) items with a matching category will
   * spend cooling down before becoming usable again.
   * 
   * Sample Values:
   * Wind Charge: 0.5
   *
   */
  duration: number;

}