// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:shooter
 * 
 * minecraft:shooter Samples
"minecraft:shooter": {
  "ammunition": [
    {
      "item": "custom_projectile",
      "use_offhand": true,
      "search_inventory": true,
      "use_in_creative": true
    }
  ],
  "max_draw_duration": 1,
  "scale_power_by_draw_duration": true,
  "charge_on_draw": false
}


My Sword Shoot - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_shoot.json

"minecraft:shooter": {
  "ammunition": [
    {
      "item": "minecraft:snowball",
      "use_offhand": true,
      "search_inventory": true,
      "use_in_creative": true
    }
  ],
  "max_draw_duration": 1,
  "scale_power_by_draw_duration": true,
  "charge_on_draw": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Shooter (minecraft:shooter)
 * Compels an item to shoot projectiles, similarly to a bow or
 * crossbow. Must have the minecraft:use_modifiers component in
 * order to function properly.
 * Note: Ammunition used by minecraft:shooter must have the
 * minecraft:projectile component in order to function 
 * properly.
 * Note: Items equipped with the shooter component will only sustain
 * damage while shooting. Durability will remain unaffected if the
 * item is used for melee attacks.
 */
export default interface MinecraftShooter {

  /**
   * @remarks
   * Ammunition.
   * 
   * Sample Values:
   * My Sword Shoot: [{"item":"minecraft:snowball","use_offhand":true,"search_inventory":true,"use_in_creative":true}]
   *
   */
  ammunition: MinecraftShooterAmmunition[];

  /**
   * @remarks
   * Charge on draw? Default is set to false.
   */
  charge_on_draw: boolean;

  /**
   * @remarks
   * Draw Duration. Default is set to 0.
   * 
   * Sample Values:
   * My Sword Shoot: 1
   *
   */
  max_draw_duration: number;

  /**
   * @remarks
   * Scale power by draw duration? Default is set to false.
   * 
   * Sample Values:
   * My Sword Shoot: true
   *
   */
  scale_power_by_draw_duration: boolean;

}


/**
 * V1 20 50 ShooterItemComponent Ammunition
 * (_v1_20_50_ShooterItemComponent_Ammunition)
 */
export interface MinecraftShooterAmmunition {

  /**
   * @remarks
   * Ammunition item description identifier.
   */
  item: string;

  /**
   * @remarks
   * Can search inventory? Default is set to false.
   */
  search_inventory: boolean;

  /**
   * @remarks
   * Can use in creative mode? Default is set to false.
   */
  use_in_creative: boolean;

  /**
   * @remarks
   * Can use off-hand? Default is set to false.
   */
  use_offhand: boolean;

}