// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.stomp_turtle_egg
 * 
 * minecraft:behavior.stomp_turtle_egg Samples

Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.stomp_turtle_egg": {
  "priority": 4,
  "speed_multiplier": 1,
  "search_range": 10,
  "search_height": 2,
  "goal_radius": 1.14,
  "interval": 20
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

"minecraft:behavior.stomp_turtle_egg": {
  "priority": 5,
  "speed_multiplier": 1,
  "search_range": 10,
  "search_height": 2,
  "goal_radius": 1.14,
  "interval": 20
}


Zombie Pigman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_pigman.json

"minecraft:behavior.stomp_turtle_egg": {
  "priority": 6,
  "speed_multiplier": 1,
  "search_range": 10,
  "search_height": 2,
  "goal_radius": 1.14,
  "interval": 20
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Stomp Turtle Egg Behavior 
 * (minecraft:behavior.stomp_turtle_egg)
 * Allows this mob to stomp turtle eggs.
 */
export default interface MinecraftBehaviorStompTurtleEgg {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Drowned: 1.14
   *
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * A random value to determine when to randomly move somewhere. This
   * has a 1/interval chance to choose this goal
   * 
   * Sample Values:
   * Drowned: 20
   *
   *
   */
  interval?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Drowned: 4
   *
   * Husk: 5
   *
   *
   * Zombie Pigman: 6
   *
   */
  priority?: number;

  /**
   * @remarks
   * Height in blocks the mob will look for turtle eggs to move
   * towards
   * 
   * Sample Values:
   * Drowned: 2
   *
   *
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks it will look for turtle eggs to move
   * towards
   * 
   * Sample Values:
   * Drowned: 10
   *
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Drowned: 1
   *
   *
   */
  speed_multiplier?: number;

}