// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:addrider
 * 
 * minecraft:addrider Samples

Camel Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel_husk.json

"minecraft:addrider": {
  "riders": [
    {
      "entity_type": "minecraft:husk",
      "spawn_event": "minecraft:spawn_as_rider"
    },
    {
      "entity_type": "minecraft:parched",
      "spawn_event": "minecraft:ranged_mode"
    }
  ]
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "riders": [
    {
      "entity_type": "minecraft:skeleton"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:spider_stray_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "riders": [
    {
      "entity_type": "minecraft:stray"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:spider_bogged_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "riders": [
    {
      "entity_type": "minecraft:bogged"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:spider_parched_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "riders": [
    {
      "entity_type": "minecraft:parched"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:spider_wither_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "riders": [
    {
      "entity_type": "minecraft:wither_skeleton"
    }
  ]
}


Ravager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ravager.json

 * At /minecraft:entity/component_groups/minecraft:pillager_rider/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:pillager"
}

 * At /minecraft:entity/component_groups/minecraft:pillager_rider_for_raid/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:pillager",
  "spawn_event": "minecraft:spawn_for_raid"
}

 * At /minecraft:entity/component_groups/minecraft:evoker_rider_for_raid/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:evocation_illager",
  "spawn_event": "minecraft:spawn_for_raid"
}

 * At /minecraft:entity/component_groups/minecraft:pillager_captain_rider/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:pillager",
  "spawn_event": "minecraft:spawn_as_illager_captain"
}

 * At /minecraft:entity/component_groups/minecraft:vindicator_rider/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:vindicator"
}

 * At /minecraft:entity/component_groups/minecraft:vindicator_captain_rider/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:vindicator",
  "spawn_event": "minecraft:spawn_as_illager_captain"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Add Rider (minecraft:addrider)
 * Adds a rider to the entity.
 */
export default interface MinecraftAddrider {

  /**
   * @remarks
   * Type of entity to acquire as a rider
   * 
   * Sample Values:
   * Ravager: "minecraft:pillager", "minecraft:evocation_illager", "minecraft:vindicator"
   *
   */
  entity_type?: string;

  /**
   * @remarks
   * List of riders to be added to the entity. Can only spawn as
   * many riders as "minecraft:rideable" has "seat_count".
   * 
   * Sample Values:
   * Camel Husk: [{"entity_type":"minecraft:husk","spawn_event":"minecraft:spawn_as_rider"},{"entity_type":"minecraft:parched","spawn_event":"minecraft:ranged_mode"}]
   *
   */
  riders?: MinecraftAddriderRiders;

  /**
   * @remarks
   * Trigger event when a rider is acquired
   * 
   * Sample Values:
   * Ravager: "minecraft:spawn_for_raid", "minecraft:spawn_as_illager_captain"
   *
   * Strider: "minecraft:spawn_as_strider_jockey", "minecraft:spawn_baby_strider_jockey"
   *
   */
  spawn_event?: string;

}


/**
 * Entity Rider Data (Rider Data)
 * List of riders to be added to the entity. Must have no more
 * riders than "minecraft:rideable" has "seat_count".
 */
export interface MinecraftAddriderRiders {

  /**
   * @remarks
   * The entity type that will be riding this entity.
   */
  entity_type: string;

  /**
   * @remarks
   * The spawn event that will be used when the riding entity is
   * created.
   */
  spawn_event?: string;

}