// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:inventory
 * 
 * minecraft:inventory Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:inventory": {
  "inventory_size": 1
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:inventory": {
  "container_type": "horse"
}


Chest Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chest_boat.json

"minecraft:inventory": {
  "container_type": "chest_boat",
  "inventory_size": 27,
  "can_be_siphoned_from": true
}


Chest Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chest_minecart.json

"minecraft:inventory": {
  "container_type": "minecart_chest",
  "inventory_size": 27,
  "can_be_siphoned_from": true
}


Command Block Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/command_block_minecart.json

"minecraft:inventory": {}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:inventory": {
  "inventory_size": 16,
  "container_type": "horse"
}


Hopper Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hopper_minecart.json

"minecraft:inventory": {
  "container_type": "minecart_hopper",
  "inventory_size": 5,
  "can_be_siphoned_from": true
}


Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/horse.json

"minecraft:inventory": {
  "inventory_size": 2,
  "container_type": "horse"
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:inventory": {
  "inventory_size": 16,
  "container_type": "horse",
  "additional_slots_per_strength": 3
}


Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:inventory": {
  "inventory_size": 1,
  "private": true
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:inventory": {
  "inventory_size": 8
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:inventory": {
  "inventory_size": 8,
  "private": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Inventory (minecraft:inventory)
 * Defines this entity's inventory properties.
 */
export default interface MinecraftInventory {

  /**
   * @remarks
   * Number of slots that this entity can gain per extra strength
   * 
   * Sample Values:
   * Llama: 3
   *
   *
   */
  additional_slots_per_strength?: number;

  /**
   * @remarks
   * If true, the contents of this inventory can be removed by a
   * hopper
   * 
   * Sample Values:
   * Chest Boat: true
   *
   *
   */
  can_be_siphoned_from?: boolean;

  /**
   * @remarks
   * Type of container this entity has. Can be horse, minecart_chest, chest_boat,
   * minecart_hopper, inventory, container or hopper
   * 
   * Sample Values:
   * Camel: "horse"
   *
   * Chest Boat: "chest_boat"
   *
   * Chest Minecart: "minecart_chest"
   *
   */
  container_type?: string;

  /**
   * @remarks
   * Number of slots the container has
   * 
   * Sample Values:
   * Allay: 1
   *
   * Chest Boat: 27
   *
   *
   * Donkey: 16
   *
   */
  inventory_size?: number;

  /**
   * @remarks
   * If true, the entity will not drop its inventory on death
   * 
   * Sample Values:
   * Panda: true
   *
   *
   */
  private?: boolean;

  /**
   * @remarks
   * If true, the entity's inventory can only be accessed by its
   * owner or itself
   */
  restrict_to_owner?: boolean;

}