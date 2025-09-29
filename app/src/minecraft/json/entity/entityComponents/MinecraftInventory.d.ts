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

Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

"minecraft:inventory": {
  "inventory_size": 16,
  "container_type": "horse",
  "additional_slots_per_strength": 3
}


Beachager - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/entities/beachager.behavior.json

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
   * Frost Moose: 3
   *
   *
   */
  additional_slots_per_strength?: number;

  /**
   * @remarks
   * If true, the contents of this inventory can be removed by a
   * hopper
   */
  can_be_siphoned_from?: boolean;

  /**
   * @remarks
   * Type of container this entity has. Can be horse, minecart_chest, chest_boat,
   * minecart_hopper, inventory, container or hopper
   * 
   * Sample Values:
   * Frost Moose: "horse"
   *
   *
   */
  container_type?: string;

  /**
   * @remarks
   * Number of slots the container has
   * 
   * Sample Values:
   * Frost Moose: 16
   *
   *
   * Beachager: 8
   *
   */
  inventory_size?: number;

  /**
   * @remarks
   * If true, the entity will not drop its inventory on death
   * 
   * Sample Values:
   * Beachager: true
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