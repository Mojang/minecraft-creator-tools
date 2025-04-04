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

Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:skeleton"
}

 * At /minecraft:entity/component_groups/minecraft:spider_stray_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:skeleton.stray"
}

 * At /minecraft:entity/component_groups/minecraft:spider_wither_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:skeleton.wither"
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


Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

 * At /minecraft:entity/component_groups/minecraft:strider_piglin_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:zombie_pigman",
  "spawn_event": "minecraft:spawn_as_strider_jockey"
}

 * At /minecraft:entity/component_groups/minecraft:strider_parent_jockey/minecraft:addrider/: 
"minecraft:addrider": {
  "entity_type": "minecraft:strider",
  "spawn_event": "minecraft:spawn_baby_strider_jockey"
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
   * Cave Spider: "minecraft:skeleton", "minecraft:skeleton.stray", "minecraft:skeleton.wither"
   *
   */
  entity_type: string;

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
  spawn_event: string;

}