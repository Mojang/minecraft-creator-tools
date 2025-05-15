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

Journal Pencil - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/chill_dreams/complete/behavior_packs/mamm_cds/items/journal_pencil.json

"minecraft:wearable": {
  "dispensable": true,
  "slot": "slot.weapon.offhand"
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:wearable": {
  "dispensable": true,
  "slot": "slot.armor.chest"
}


Crown - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/crown.json

"minecraft:wearable": {
  "dispensable": true,
  "slot": "slot.armor.head"
}


My Boots - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_boots.json

"minecraft:wearable": {
  "dispensable": true,
  "slot": "slot.armor.feet"
}


My Leggings - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_leggings.json

"minecraft:wearable": {
  "dispensable": true,
  "slot": "slot.armor.legs"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Wearable (minecraft:wearable)
 * Sets the wearable item component.
 * Note: Here are the following equipment slots that can be set for
 * the value of slot: slot.weapon.mainhand, slot.weapon.offhand, slot.armor.head,
 * slot.armor.chest, slot.armor.legs, slot.armor.feet, slot.hotbar,
 * slot.inventory, slot.enderchest, slot.saddle, slot.armor, slot.chest,
 * slot.equippable.
 */
export default interface MinecraftWearable {

  /**
   * @remarks
   * 
   * Sample Values:
   * Chestplate: true
   *
   *
   */
  dispensable: boolean;

  /**
   * @remarks
   * How much protection the wearable item provides. Default is set
   * to 0.
   */
  protection: number;

  /**
   * @remarks
   * Specifies where the item can be worn. If any non-hand slot is
   * chosen, the max stack size is set to 1.
   * 
   * Sample Values:
   * Chestplate: "slot.armor.chest"
   *
   * Crown: "slot.armor.head"
   *
   * My Boots: "slot.armor.feet"
   *
   */
  slot: string;

}