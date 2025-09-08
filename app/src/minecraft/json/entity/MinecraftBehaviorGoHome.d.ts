// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.go_home
 * 
 * minecraft:behavior.go_home Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.go_home": {
  "priority": 4,
  "speed_multiplier": 1,
  "interval": 1,
  "goal_radius": 1.2,
  "on_home": [
    {
      "filters": {
        "any_of": [
          {
            "test": "is_block",
            "subject": "block",
            "value": "minecraft:bee_nest"
          },
          {
            "test": "is_block",
            "subject": "block",
            "value": "minecraft:beehive"
          }
        ]
      },
      "event": "minecraft:bee_returned_to_hive",
      "target": "block"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_block",
            "subject": "block",
            "operator": "!=",
            "value": "minecraft:bee_nest"
          },
          {
            "test": "is_block",
            "subject": "block",
            "operator": "!=",
            "value": "minecraft:beehive"
          }
        ]
      },
      "event": "find_hive_event",
      "target": "self"
    }
  ],
  "on_failed": [
    {
      "event": "find_hive_event",
      "target": "self"
    }
  ]
}


Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:behavior.go_home": {
  "priority": 6,
  "interval": 200,
  "speed_multiplier": 0.6,
  "goal_radius": 4,
  "on_failed": [
    {
      "event": "go_back_to_spawn_failed",
      "target": "self"
    }
  ]
}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

"minecraft:behavior.go_home": {
  "priority": 1,
  "speed_multiplier": 1,
  "interval": 700,
  "goal_radius": 4,
  "on_home": [
    {
      "event": "minecraft:go_lay_egg",
      "target": "self"
    }
  ]
}


Nardolphle - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/nardolphle.behavior.json

"minecraft:behavior.go_home": {
  "priority": 1,
  "speed_multiplier": 1,
  "interval": 700,
  "goal_radius": 4,
  "on_home": {
    "event": "minecraft:go_lay_egg",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Go Home Behavior (minecraft:behavior.go_home)
 * Allows the mob to move back to the position they were 
 * spawned.
 */
export default interface MinecraftBehaviorGoHome {

  /**
   * @remarks
   * Distance in blocks that the mob is considered close enough to
   * the end of the current path. A new path will then be calculated to
   * continue toward home.
   */
  calculate_new_path_radius?: number;

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot.
   * 
   * Sample Values:
   * Bee: 1.2
   *
   * Piglin Brute: 4
   *
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * A random value to determine when to randomly move somewhere. This
   * has a 1/interval chance to choose this goal.
   * 
   * Sample Values:
   * Bee: 1
   *
   * Piglin Brute: 200
   *
   * Turtle: 700
   *
   */
  interval?: number;

  /**
   * @remarks
   * Event(s) to run when this goal fails.
   * 
   * Sample Values:
   * Bee: [{"event":"find_hive_event","target":"self"}]
   *
   * Piglin Brute: [{"event":"go_back_to_spawn_failed","target":"self"}]
   *
   */
  on_failed?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event(s) to run when this mob gets home.
   * 
   * Sample Values:
   * Bee: [{"filters":{"any_of":[{"test":"is_block","subject":"block","value":"minecraft:bee_nest"},{"test":"is_block","subject":"block","value":"minecraft:beehive"}]},"event":"minecraft:bee_returned_to_hive","target":"block"},{"filters":{"all_of":[{"test":"is_block","subject":"block","operator":"!=","value":"minecraft:bee_nest"},{"test":"is_block","subject":"block","operator":"!=","value":"minecraft:beehive"}]},"event":"find_hive_event","target":"self"}]
   *
   * Turtle: [{"event":"minecraft:go_lay_egg","target":"self"}]
   *
   * Nardolphle: {"event":"minecraft:go_lay_egg","target":"self"}
   *
   */
  on_home?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Bee: 4
   *
   * Piglin Brute: 6
   *
   * Turtle: 1
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI 
   * Goal.
   * 
   * Sample Values:
   * Bee: 1
   *
   * Piglin Brute: 0.6
   *
   *
   */
  speed_multiplier?: number;

}