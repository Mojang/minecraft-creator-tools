// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:enchantable
 * 
 * minecraft:enchantable Samples

Item Axe Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/axe_turret_kit.item.json

"minecraft:enchantable": {
  "slot": "pickaxe",
  "value": 14
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:enchantable": {
  "value": 10,
  "slot": "armor_torso"
}


My Boots - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_boots.json

"minecraft:enchantable": {
  "value": 10,
  "slot": "armor_feet"
}


My Helm - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_helm.json

"minecraft:enchantable": {
  "value": 10,
  "slot": "armor_head"
}


My Leggings - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_leggings.json

"minecraft:enchantable": {
  "value": 10,
  "slot": "armor_legs"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Enchantable Item (minecraft:enchantable)
 * Determines what enchantments can be applied to the item. Not all
 * enchantments will have an effect on all item components.
 * Note: The following enchantment slot types that can be set for
 * the value of `slot`: sword, bow, pickaxe, armor_head, armor_torso,
 * armor_legs, armor_feet.
 */
export default interface MinecraftEnchantable {

  /**
   * @remarks
   * Specifies which types of enchantments can be applied. For
   * example, `bow` would allow this item to be enchanted as if it
   * were a bow.
   * 
   * Sample Values:
   * Chestplate: "armor_torso"
   *
   * My Boots: "armor_feet"
   *
   * My Helm: "armor_head"
   *
   */
  slot: string;

  /**
   * @remarks
   * Specifies the value of the enchantment (minimum of 0).
   * 
   * Sample Values:
   * Chestplate: 10
   *
   *
   */
  value: number;

}