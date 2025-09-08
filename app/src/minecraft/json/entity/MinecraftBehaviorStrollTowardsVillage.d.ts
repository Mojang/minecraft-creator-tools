// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.stroll_towards_village
 * 
 * minecraft:behavior.stroll_towards_village Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.stroll_towards_village": {
  "priority": 11,
  "speed_multiplier": 1,
  "goal_radius": 3,
  "cooldown_time": 10,
  "search_range": 32,
  "start_chance": 0.005
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Stroll Towards Village Behavior
 * (minecraft:behavior.stroll_towards_village)
 * Allows the mob to move into a random location within a village
 * within the search range.
 */
export default interface MinecraftBehaviorStrollTowardsVillage {

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   * 
   * Sample Values:
   * Fox: 10
   *
   */
  cooldown_time?: number;

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Fox: 3
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
   * Fox: 11
   *
   */
  priority?: number;

  /**
   * @remarks
   * The distance in blocks to search for points inside villages. If
   * <= 0, find the closest village regardless of distance.
   * 
   * Sample Values:
   * Fox: 32
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Fox: 1
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * This is the chance that the mob will start this goal, from 0
   * to 1
   * 
   * Sample Values:
   * Fox: 0.005
   *
   */
  start_chance?: number;

}