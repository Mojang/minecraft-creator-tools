// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_land
 * 
 * minecraft:behavior.move_to_land Samples

Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.move_to_land": {
  "priority": 6,
  "search_range": 30,
  "search_height": 8,
  "search_count": 80,
  "goal_radius": 2
}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

"minecraft:behavior.move_to_land": {
  "priority": 6,
  "search_range": 16,
  "search_height": 5,
  "goal_radius": 0.5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Land Behavior (minecraft:behavior.move_to_land)
 * Allows the mob to move back onto land when in water.
 */
export default interface MinecraftBehaviorMoveToLand {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Frog: 2
   *
   * Turtle: 0.5
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
   * Frog: 6
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * The number of blocks each tick that the mob will check within its
   * search range and height for a valid block to move to. A value of
   * 0 will have the mob check every block within range in one 
   * tick
   * 
   * Sample Values:
   * Frog: 80
   *
   */
  search_count?: number;

  /**
   * @remarks
   * Height in blocks the mob will look for land to move towards
   * 
   * Sample Values:
   * Frog: 8
   *
   * Turtle: 5
   *
   *
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks it will look for land to move towards
   * 
   * Sample Values:
   * Frog: 30
   *
   * Turtle: 16
   *
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier?: number;

}