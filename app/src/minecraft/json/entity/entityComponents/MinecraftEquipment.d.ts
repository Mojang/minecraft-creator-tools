// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:equipment
 * 
 * minecraft:equipment Samples

Gray Zombie Leader - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/gray_zombie_leader.behavior.json

"minecraft:equipment": {
  "table": "loot_tables/entities/zombie_equipment.json"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Equipment (minecraft:equipment)
 * Sets the Equipment table to use for this Entity.
 */
export default interface MinecraftEquipment {

  /**
   * @remarks
   * A list of slots with the chance to drop an equipped item from
   * that slot.
   */
  slot_drop_chance?: string[];

  /**
   * @remarks
   * The file path to the equipment table, relative to the behavior pack's
   * root.
   * 
   * Sample Values:
   * Gray Zombie Leader: "loot_tables/entities/zombie_equipment.json"
   *
   */
  table?: string;

}