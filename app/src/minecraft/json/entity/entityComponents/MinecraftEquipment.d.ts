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

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:equipment": {
  "table": "loot_tables/entities/skeleton_gear.json"
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:equipment": {
  "slot_drop_chance": [
    {
      "slot": "slot.weapon.mainhand",
      "drop_chance": 1
    }
  ]
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

 * At /minecraft:entity/component_groups/minecraft:ranged_equipment/minecraft:equipment/: 
"minecraft:equipment": {
  "table": "loot_tables/entities/drowned_ranged_equipment.json",
  "slot_drop_chance": [
    {
      "slot": "slot.weapon.offhand",
      "drop_chance": 1
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:melee_equipment/minecraft:equipment/: 
"minecraft:equipment": {
  "table": "loot_tables/entities/drowned_equipment.json",
  "slot_drop_chance": [
    {
      "slot": "slot.weapon.offhand",
      "drop_chance": 1
    }
  ]
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:equipment": {
  "table": "loot_tables/entities/fox_equipment.json",
  "slot_drop_chance": [
    {
      "slot": "slot.weapon.mainhand",
      "drop_chance": 1
    }
  ]
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

"minecraft:equipment": {
  "table": "loot_tables/entities/zombie_equipment.json"
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

 * At /minecraft:entity/component_groups/ranged_unit/minecraft:equipment/: 
"minecraft:equipment": {
  "table": "loot_tables/entities/piglin_gear_ranged.json"
}

 * At /minecraft:entity/component_groups/melee_unit/minecraft:equipment/: 
"minecraft:equipment": {
  "table": "loot_tables/entities/piglin_gear_melee.json"
}


Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:equipment": {
  "table": "loot_tables/entities/piglin_brute_gear.json"
}


Vex - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vex.json

"minecraft:equipment": {
  "table": "loot_tables/entities/vex_gear.json"
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:equipment": {
  "slot_drop_chance": [
    {
      "slot": "slot.weapon.mainhand",
      "drop_chance": 0
    }
  ]
}


Wither Skeleton - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither_skeleton.json

"minecraft:equipment": {
  "table": "loot_tables/entities/wither_skeleton_gear.json"
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
   * 
   * Sample Values:
   * Copper Golem: [{"slot":"slot.weapon.mainhand","drop_chance":1}]
   *
   * Drowned: [{"slot":"slot.weapon.offhand","drop_chance":1}]
   *
   *
   * Villager v2: [{"slot":"slot.weapon.mainhand","drop_chance":0}]
   *
   */
  slot_drop_chance?: string[];

  /**
   * @remarks
   * The file path to the equipment table, relative to the behavior pack's
   * root.
   * 
   * Sample Values:
   * Bogged: "loot_tables/entities/skeleton_gear.json"
   *
   * Drowned: "loot_tables/entities/drowned_ranged_equipment.json", "loot_tables/entities/drowned_equipment.json"
   *
   */
  table?: string;

}