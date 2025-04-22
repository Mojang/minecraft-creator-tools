// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.trade_with_player
 * 
 * minecraft:behavior.trade_with_player Samples

Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.trade_with_player": {
  "priority": 2,
  "filters": {
    "all_of": [
      {
        "all_of": [
          {
            "test": "in_water",
            "value": false
          }
        ]
      },
      {
        "any_of": [
          {
            "test": "on_ground",
            "value": true
          },
          {
            "test": "is_sleeping",
            "value": true
          }
        ]
      }
    ]
  }
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.trade_with_player": {
  "priority": 1,
  "filters": {
    "all_of": [
      {
        "all_of": [
          {
            "test": "in_water",
            "value": false
          }
        ]
      },
      {
        "any_of": [
          {
            "test": "on_ground",
            "value": true
          },
          {
            "test": "is_sleeping",
            "value": true
          }
        ]
      }
    ]
  }
}


Beachager - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/entities/beachager.behavior.json

"minecraft:behavior.trade_with_player": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Trade With Player Behavior 
 * (minecraft:behavior.trade_with_player)
 * Allows the player to trade with this mob. When the goal starts, it
 * will stop the mob's navigation.
 */
export default interface MinecraftBehaviorTradeWithPlayer {

  /**
   * @remarks
   * Conditions that need to be met for the behavior to start.
   * 
   * Sample Values:
   * Villager V2: {"all_of":[{"all_of":[{"test":"in_water","value":false}]},{"any_of":[{"test":"on_ground","value":true},{"test":"is_sleeping","value":true}]}]}
   *
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The max distance that the mob can be from the player before exiting
   * the goal.
   */
  max_distance_from_player: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager V2: 2
   *
   * Villager: 1
   *
   *
   *
   */
  priority: number;

}