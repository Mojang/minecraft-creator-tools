// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:despawn
 * 
 * minecraft:despawn Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:despawn": {
  "despawn_from_distance": {}
}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:despawn": {
  "despawn_from_distance": {
    "min_distance": 32,
    "max_distance": 40
  }
}


Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:despawn": {
  "filters": {
    "any_of": [
      {
        "all_of": [
          {
            "test": "is_persistent",
            "value": false
          },
          {
            "test": "distance_to_nearest_player",
            "operator": ">",
            "value": 54
          }
        ]
      },
      {
        "all_of": [
          {
            "test": "is_persistent",
            "value": false
          },
          {
            "test": "inactivity_timer",
            "subject": "self",
            "value": 30
          },
          {
            "test": "random_chance",
            "value": 800
          },
          {
            "test": "distance_to_nearest_player",
            "operator": ">",
            "value": 32
          }
        ]
      }
    ]
  }
}


Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:despawn": {
  "remove_child_entities": true,
  "filters": {
    "all_of": [
      {
        "any_of": [
          {
            "test": "is_family",
            "subject": "self",
            "value": "wandering_trader_despawning"
          },
          {
            "test": "has_trade_supply",
            "subject": "self",
            "value": false
          }
        ]
      },
      {
        "test": "distance_to_nearest_player",
        "operator": ">",
        "value": 24
      }
    ]
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Despawn (minecraft:despawn)
 * Despawns the Actor when the despawn rules or optional filters
 * evaluate to true.
 */
export default interface MinecraftDespawn {

  /**
   * @remarks
   * Determines if "min_range_random_chance" is used in the standard
   * despawn rules
   */
  despawn_from_chance: boolean;

  /**
   * @remarks
   * Specifies if the "min_distance" and "max_distance" are used in
   * the standard despawn rules.
   * 
   * Sample Values:
   * Armadillo: {}
   *
   *
   * Fish: {"min_distance":32,"max_distance":40}
   *
   *
   */
  despawn_from_distance: MinecraftDespawnDespawnFromDistance[];

  /**
   * @remarks
   * Determines if the "min_range_inactivity_timer" is used in the
   * standard despawn rules.
   */
  despawn_from_inactivity: boolean;

  /**
   * @remarks
   * Determines if the mob is instantly despawned at the edge of
   * simulation distance in the standard despawn rules.
   */
  despawn_from_simulation_edge: boolean;

  /**
   * @remarks
   * The list of conditions that must be satisfied before the Actor is
   * despawned. If a filter is defined then standard despawn rules are
   * ignored.
   * 
   * Sample Values:
   * Piglin Brute: {"any_of":[{"all_of":[{"test":"is_persistent","value":false},{"test":"distance_to_nearest_player","operator":">","value":54}]},{"all_of":[{"test":"is_persistent","value":false},{"test":"inactivity_timer","subject":"self","value":30},{"test":"random_chance","value":800},{"test":"distance_to_nearest_player","operator":">","value":32}]}]}
   *
   * Wandering Trader: {"all_of":[{"any_of":[{"test":"is_family","subject":"self","value":"wandering_trader_despawning"},{"test":"has_trade_supply","subject":"self","value":false}]},{"test":"distance_to_nearest_player","operator":">","value":24}]}
   *
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The amount of time in seconds that the mob must be inactive.
   */
  min_range_inactivity_timer: number;

  /**
   * @remarks
   * A random chance between 1 and the given value.
   */
  min_range_random_chance: number;

  /**
   * @remarks
   * If true, all entities linked to this entity in a child
   * relationship (eg. leashed) will also be despawned.
   * 
   * Sample Values:
   * Wandering Trader: true
   *
   */
  remove_child_entities: boolean;

}


/**
 * Specifies if the "min_distance" and "max_distance" are used in
 * the standard despawn rules.
 */
export interface MinecraftDespawnDespawnFromDistance {

  /**
   * @remarks
   * maximum distance for standard despawn rules to instantly despawn the
   * mob.
   */
  max_distance: number;

  /**
   * @remarks
   * minimum distance for standard despawn rules to try to despawn the
   * mob.
   */
  min_distance: number;

}