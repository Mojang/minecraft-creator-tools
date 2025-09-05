// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_village
 * 
 * minecraft:behavior.move_to_village Samples

Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.move_to_village": {
  "priority": 6,
  "speed_multiplier": 0.7
}


Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

"minecraft:behavior.move_to_village": {
  "priority": 5,
  "speed_multiplier": 1,
  "goal_radius": 2
}


Vindicator - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vindicator.json

"minecraft:behavior.move_to_village": {
  "priority": 4,
  "speed_multiplier": 1,
  "goal_radius": 2
}


Witch - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/witch.json

"minecraft:behavior.move_to_village": {
  "priority": 3,
  "speed_multiplier": 1.2,
  "goal_radius": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Village Behavior 
 * (minecraft:behavior.move_to_village)
 * Allows the mob to move into a random location within a
 * village.
 */
export default interface MinecraftBehaviorMoveToVillage {

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   */
  cooldown_time?: number;

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Pillager: 2
   *
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Evocation Illager: 6
   *
   * Pillager: 5
   *
   *
   * Vindicator: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * The distance in blocks to search for villages. If <= 0, find the
   * closest village regardless of distance.
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Evocation Illager: 0.7
   *
   * Pillager: 1
   *
   *
   * Witch: 1.2
   *
   */
  speed_multiplier?: number;

}