// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_water
 * 
 * minecraft:behavior.move_to_water Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.move_to_water": {
  "priority": 6,
  "search_range": 16,
  "search_height": 5,
  "search_count": 1,
  "goal_radius": 0.1
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.move_to_water": {
  "priority": 1,
  "search_range": 15,
  "search_height": 5
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.move_to_water": {
  "priority": 3,
  "search_range": 20,
  "search_height": 5,
  "goal_radius": 1.5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Water Behavior (minecraft:behavior.move_to_water)
 * Allows the mob to move back into water when on land.
 */
export default interface MinecraftBehaviorMoveToWater {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Axolotl: 0.1
   *
   * Frog: 1.5
   *
   */
  goal_radius: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Axolotl: 6
   *
   * Dolphin: 1
   *
   * Frog: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * The number of blocks each tick that the mob will check within its
   * search range and height for a valid block to move to. A value of
   * 0 will have the mob check every block within range in one 
   * tick
   * 
   * Sample Values:
   * Axolotl: 1
   *
   */
  search_count: number;

  /**
   * @remarks
   * Height in blocks the mob will look for water to move towards
   * 
   * Sample Values:
   * Axolotl: 5
   *
   *
   */
  search_height: number;

  /**
   * @remarks
   * The distance in blocks it will look for water to move 
   * towards
   * 
   * Sample Values:
   * Axolotl: 16
   *
   * Dolphin: 15
   *
   * Frog: 20
   *
   */
  search_range: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier: number;

}