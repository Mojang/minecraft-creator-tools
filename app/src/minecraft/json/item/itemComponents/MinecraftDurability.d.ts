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
"minecraft:durability": {
  "damage_chance": {
    "min": 10,
    "max": 50
  },
  "max_durability": 36
}


Item Axe Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/axe_turret_kit.item.json

"minecraft:durability": {
  "max_durability": 251
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:durability": {
  "max_durability": 200
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
 * Minecraft Durability Item (minecraft:durability)
 * Sets how much damage the item can take before breaking, and
 * allows the item to be combined at an anvil, grindstone, or
 * crafting table.
 */
export default interface MinecraftDurability {

  /**
   * @remarks
   * Specifies the percentage chance of this item losing durability. Default
   * is set to 100. Defined as an int range with min and max 
   * value.
   * 
   * Sample Values:
   * My Sword Chuck: {"min":10,"max":50}
   *
   *
   * My Sword Singing: {"min":0,"max":0}
   *
   * My Sword Weak: {"min":100,"max":100}
   *
   */
  damage_chance: MinecraftDurabilityDamageChance;

  /**
   * @remarks
   * Max durability is the amount of damage that this item can take
   * before breaking. This is a required parameter and has a
   * minimum of 0.
   * 
   * Sample Values:
   * Chestplate: 200
   *
   *
   * My Sword Chuck: 10
   *
   *
   * My Sword Singing: 1000
   *
   */
  max_durability: number;

}


/**
 * IntRange Item (IntRange)
 */
export interface MinecraftDurabilityDamageChance {

  max: number;

  min: number;

}