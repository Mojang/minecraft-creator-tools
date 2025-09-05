// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:use_modifiers
 * 
 * minecraft:use_modifiers Samples

Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:use_modifiers": {
  "use_duration": 1.6,
  "movement_modifier": 0.35
}


Cooked Dream Turkey - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/chill_dreams/1_dream_turkey/behavior_packs/mamm_cds/items/cooked_dream_turkey.json

"minecraft:use_modifiers": {
  "use_duration": 4,
  "movement_modifier": 0.35
}


My Sword Shoot - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_shoot.json

"minecraft:use_modifiers": {
  "use_duration": 3
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Use Modifiers (minecraft:use_modifiers)
 * This component modifies use effects, including how long the item
 * takes to use and the player's speed when used in combination with
 * components like "shooter", "throwable", or "food".
 */
export default interface MinecraftUseModifiers {

  /**
   * @remarks
   * Modifier value to scale the players movement speed when item is
   * in use.
   * 
   * Sample Values:
   * Apple: 0.35
   *
   *
   */
  movement_modifier?: number;

  /**
   * @remarks
   * How long the item takes to use in seconds.
   * 
   * Sample Values:
   * Apple: 1.6
   *
   * Cooked Dream Turkey: 4
   *
   *
   * My Sword Shoot: 3
   *
   */
  use_duration?: number;

}