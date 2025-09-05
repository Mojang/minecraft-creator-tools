// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:durability
 * 
 * minecraft:durability Samples

Item Axe Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/axe_turret_kit.item.json

"minecraft:durability": {
  "max_durability": 251
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:durability": {
  "max_durability": 200
}


My Sword - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword.json

"minecraft:durability": {
  "damage_chance": {
    "min": 10,
    "max": 50
  },
  "max_durability": 36
}


My Sword Chuck - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_chuck.json

"minecraft:durability": {
  "damage_chance": {
    "min": 10,
    "max": 50
  },
  "max_durability": 10
}


My Sword Singing - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_singing.json

"minecraft:durability": {
  "damage_chance": {
    "min": 0,
    "max": 0
  },
  "max_durability": 1000
}


My Sword Weak - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_weak.json

"minecraft:durability": {
  "damage_chance": {
    "min": 100,
    "max": 100
  },
  "max_durability": 2
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Durability (minecraft:durability)
 * The durability item component specifies how much damage the item
 * takes before breaking, and allows the item to be combined to
 * repair or augment them.
 */
export default interface MinecraftDurability {

  /**
   * @remarks
   * Specifies the percentage chance of this item losing durability. Default
   * is set to 100. Defined as an int range with min and max 
   * value.
   * 
   * Sample Values:
   * My Sword: {"min":10,"max":50}
   *
   *
   * My Sword Singing: {"min":0,"max":0}
   *
   * My Sword Weak: {"min":100,"max":100}
   *
   */
  damage_chance?: MinecraftDurabilityDamageChance;

  /**
   * @remarks
   * Max durability is the amount of damage that this item can take
   * before breaking. This is a required parameter and has a
   * minimum of 0.
   * 
   * Sample Values:
   * Item Axe Turret Kit: 251
   *
   *
   * Chestplate: 200
   *
   *
   * My Sword: 36
   *
   */
  max_durability: number;

}


/**
 * Item Components IntRange (IntRange)
 */
export interface MinecraftDurabilityDamageChance {

  max?: number;

  min?: number;

}