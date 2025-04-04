// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:spawn_entity
 * 
 * minecraft:spawn_entity Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:spawn_entity": {
  "entities": {
    "min_wait_time": 300,
    "max_wait_time": 600,
    "spawn_sound": "mob.armadillo.scute_drop",
    "spawn_item": "armadillo_scute"
  }
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:spawn_entity": {
  "entities": [
    {
      "min_wait_time": 300,
      "max_wait_time": 600,
      "spawn_sound": "plop",
      "spawn_item": "egg",
      "filters": [
        {
          "test": "rider_count",
          "subject": "self",
          "operator": "==",
          "value": 0
        },
        {
          "test": "enum_property",
          "subject": "self",
          "domain": "minecraft:climate_variant",
          "value": "temperate"
        }
      ]
    },
    {
      "min_wait_time": 300,
      "max_wait_time": 600,
      "spawn_sound": "plop",
      "spawn_item": "brown_egg",
      "filters": [
        {
          "test": "rider_count",
          "subject": "self",
          "operator": "==",
          "value": 0
        },
        {
          "test": "enum_property",
          "subject": "self",
          "domain": "minecraft:climate_variant",
          "value": "warm"
        }
      ]
    },
    {
      "min_wait_time": 300,
      "max_wait_time": 600,
      "spawn_sound": "plop",
      "spawn_item": "blue_egg",
      "filters": [
        {
          "test": "rider_count",
          "subject": "self",
          "operator": "==",
          "value": 0
        },
        {
          "test": "enum_property",
          "subject": "self",
          "domain": "minecraft:climate_variant",
          "value": "cold"
        }
      ]
    }
  ]
}


Ocelot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ocelot.json

"minecraft:spawn_entity": {
  "entities": {
    "filters": [
      {
        "test": "random_chance",
        "value": 7
      }
    ],
    "min_wait_time": 0,
    "max_wait_time": 0,
    "num_to_spawn": 2,
    "single_use": true,
    "spawn_entity": "minecraft:ocelot",
    "spawn_event": "minecraft:entity_born",
    "spawn_method": "born",
    "spawn_sound": ""
  }
}


Sniffer - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/sniffer.json

"minecraft:spawn_entity": {
  "entities": {
    "min_wait_time": 0,
    "max_wait_time": 0,
    "spawn_sound": "plop",
    "spawn_item": "sniffer_egg",
    "spawn_item_event": {
      "event": "on_egg_spawned",
      "target": "self"
    },
    "single_use": true
  }
}


Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:spawn_entity": {
  "entities": [
    {
      "min_wait_time": 0,
      "max_wait_time": 0,
      "spawn_entity": "trader_llama",
      "spawn_event": "minecraft:from_wandering_trader",
      "single_use": true,
      "num_to_spawn": 2,
      "should_leash": true
    }
  ]
}


Dream Turkey - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/chill_dreams/1_dream_turkey/behavior_packs/mamm_cds/entities/dream_turkey.json

"minecraft:spawn_entity": {
  "entities": {
    "min_wait_time": 300,
    "max_wait_time": 600,
    "spawn_sound": "plop",
    "spawn_item": "egg",
    "filters": {
      "test": "rider_count",
      "subject": "self",
      "operator": "==",
      "value": 0
    }
  }
}


Memory Jar - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/chill_dreams/complete/behavior_packs/mamm_cds/entities/memory_jar.json

"minecraft:spawn_entity": {
  "entities": {
    "min_wait_time": 300,
    "max_wait_time": 600,
    "spawn_sound": "place",
    "spawn_item": "egg"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Spawn Entity (minecraft:spawn_entity)
 * Adds a timer after which this entity will spawn another entity or
 * item (similar to vanilla's chicken's egg-laying behavior).
 */
export default interface MinecraftSpawnEntity {

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: {"min_wait_time":300,"max_wait_time":600,"spawn_sound":"mob.armadillo.scute_drop","spawn_item":"armadillo_scute"}
   *
   * Chicken: [{"min_wait_time":300,"max_wait_time":600,"spawn_sound":"plop","spawn_item":"egg","filters":[{"test":"rider_count","subject":"self","operator":"==","value":0},{"test":"enum_property","subject":"self","domain":"minecraft:climate_variant","value":"temperate"}]},{"min_wait_time":300,"max_wait_time":600,"spawn_sound":"plop","spawn_item":"brown_egg","filters":[{"test":"rider_count","subject":"self","operator":"==","value":0},{"test":"enum_property","subject":"self","domain":"minecraft:climate_variant","value":"warm"}]},{"min_wait_time":300,"max_wait_time":600,"spawn_sound":"plop","spawn_item":"blue_egg","filters":[{"test":"rider_count","subject":"self","operator":"==","value":0},{"test":"enum_property","subject":"self","domain":"minecraft:climate_variant","value":"cold"}]}]
   *
   * Ocelot: {"filters":[{"test":"random_chance","value":7}],"min_wait_time":0,"max_wait_time":0,"num_to_spawn":2,"single_use":true,"spawn_entity":"minecraft:ocelot","spawn_event":"minecraft:entity_born","spawn_method":"born","spawn_sound":""}
   *
   */
  entities: MinecraftSpawnEntityEntities;

  /**
   * @remarks
   * If present, the specified entity will only spawn if the filter
   * evaluates to true.
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum amount of time to randomly wait in seconds before another
   * entity is spawned.
   */
  max_wait_time: number;

  /**
   * @remarks
   * Minimum amount of time to randomly wait in seconds before another
   * entity is spawned.
   */
  min_wait_time: number;

  /**
   * @remarks
   * The number of entities of this type to spawn each time that this
   * triggers.
   */
  num_to_spawn: number;

  /**
   * @remarks
   * If true, this the spawned entity will be leashed to the 
   * parent.
   */
  should_leash: boolean;

  /**
   * @remarks
   * If true, this component will only ever spawn the specified entity
   * once.
   */
  single_use: boolean;

  /**
   * @remarks
   * Identifier of the entity to spawn, leave empty to spawn the item
   * defined by "spawn_item" instead.
   */
  spawn_entity: string;

  /**
   * @remarks
   * Event to call on the spawned entity when it spawns.
   */
  spawn_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Item identifier of the item to spawn.
   */
  spawn_item: string;

  /**
   * @remarks
   * Event to call on this entity when the item is spawned.
   */
  spawn_item_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Method to use to spawn the entity.
   */
  spawn_method: string;

  /**
   * @remarks
   * Identifier of the sound effect to play when the entity is
   * spawned.
   */
  spawn_sound: string;

}


/**
 * Entities (entities)
 */
export interface MinecraftSpawnEntityEntities {

  filters: MinecraftSpawnEntityEntitiesFilters[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: 600
   *
   */
  max_wait_time: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: 300
   *
   */
  min_wait_time: number;

  num_to_spawn: number;

  should_leash: string;

  single_use: string;

  spawn_entity: string;

  spawn_event: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: "armadillo_scute"
   *
   */
  spawn_item: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: "mob.armadillo.scute_drop"
   *
   */
  spawn_sound: string;

}


/**
 * Filters (filters)
 */
export interface MinecraftSpawnEntityEntitiesFilters {

  /**
   * @remarks
   * 
   * Sample Values:
   * Chicken: "=="
   *
   */
  operator: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Chicken: "self"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Chicken: "rider_count"
   *
   */
  test: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Chicken: 0
   *
   */
  value: number;

}