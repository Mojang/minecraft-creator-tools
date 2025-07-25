// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.play
 * 
 * minecraft:behavior.play Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.play": {
  "priority": 8,
  "speed_multiplier": 0.6,
  "friend_types": [
    {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "villager"
          },
          {
            "test": "is_baby",
            "subject": "other",
            "operator": "==",
            "value": true
          }
        ]
      }
    }
  ]
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.play": {
  "priority": 8,
  "speed_multiplier": 0.32
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Play Behavior (minecraft:behavior.play)
 * Allows the mob to play with other mobs by chasing each other and
 * moving around randomly.
 */
export default interface MinecraftBehaviorPlay {

  /**
   * @remarks
   * Percent chance that the mob will start this goal, from 0 to 
   * 1.
   */
  chance_to_start: number;

  /**
   * @remarks
   * The distance (in blocks) that the mob tries to be in range of
   * the friend it's following.
   */
  follow_distance: number;

  /**
   * @remarks
   * The dimensions of the AABB used to search for a potential friend to
   * play with.
   */
  friend_search_area: number[];

  /**
   * @remarks
   * The entity type(s) to consider when searching for a potential friend
   * to play with.
   * 
   * Sample Values:
   * Villager v2: [{"filters":{"all_of":[{"test":"is_family","subject":"other","value":"villager"},{"test":"is_baby","subject":"other","operator":"==","value":true}]}}]
   *
   */
  friend_types: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The max amount of seconds that the mob will play for before exiting
   * the Goal.
   */
  max_play_duration_seconds: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 8
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * The height (in blocks) that the mob will search within to find a
   * random position position to move to. Must be at least 1.
   */
  random_pos_search_height: number;

  /**
   * @remarks
   * The distance (in blocks) on ground that the mob will search within
   * to find a random position to move to. Must be at least 1.
   */
  random_pos_search_range: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI 
   * Goal.
   * 
   * Sample Values:
   * Villager v2: 0.6
   *
   * Villager: 0.32
   *
   */
  speed_multiplier: number;

}