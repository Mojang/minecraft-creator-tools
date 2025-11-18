// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:wearable
 * 
 * minecraft:wearable Samples

Journal - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/chill_dreams/complete/behavior_packs/mamm_cds/items/journal.json

"minecraft:wearable": {
  "dispensable": true,
  "slot": "slot.weapon.offhand"
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:wearable": {
  "slot": "slot.armor.chest"
}


Crown - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/crown.json

"minecraft:wearable": {
  "slot": "slot.armor.head"
}


My Boots - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_boots.json

"minecraft:wearable": {
  "slot": "slot.armor.feet"
}


My Leggings - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_leggings.json

"minecraft:wearable": {
  "slot": "slot.armor.legs"
}


Wrench - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/wrench.json

"minecraft:wearable": {
  "slot": "slot.weapon.offhand"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Wearable (minecraft:wearable)
 * Wearable items can be worn by a player in a specified slot.
 */
export default interface MinecraftWearable {

  /**
   * @remarks
   * 
   * Sample Values:
   * Journal: true
   *
   *
   */
  dispensable?: string;

  /**
   * @remarks
   * Determines whether the Player's location is hidden on Locator Maps
   * and the Locator Bar when the wearable item is worn. Default is
   * false.
   */
  hides_player_location?: boolean;

  /**
   * @remarks
   * How much protection the wearable item provides. Default is set
   * to 0.
   */
  protection?: number;

  /**
   * @remarks
   * Specifies where the item can be worn. If any non-hand slot is
   * chosen, the max stack size is set to 1.
   * 
   * Sample Values:
   * Journal: "slot.weapon.offhand"
   *
   *
   * Chestplate: "slot.armor.chest"
   *
   * Crown: "slot.armor.head"
   *
   */
  slot: string;

}


export enum MinecraftWearableSlot {
  slotArmorBody = `slot.armor.body`,
  slotArmorChest = `slot.armor.chest`,
  slotArmorFeet = `slot.armor.feet`,
  slotArmorHead = `slot.armor.head`,
  slotArmorLegs = `slot.armor.legs`,
  slotWeaponOffhand = `slot.weapon.offhand`
}