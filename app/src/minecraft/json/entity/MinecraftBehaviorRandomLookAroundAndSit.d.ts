// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_look_around_and_sit
 * 
 * minecraft:behavior.random_look_around_and_sit Samples

Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.random_look_around_and_sit": {
  "priority": 4,
  "continue_if_leashed": true,
  "continue_sitting_on_reload": true,
  "min_look_count": 2,
  "max_look_count": 5,
  "min_look_time": 80,
  "max_look_time": 100,
  "min_angle_of_view_horizontal": -30,
  "max_angle_of_view_horizontal": 30,
  "random_look_around_cooldown": 5,
  "probability": 0.001
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.random_look_around_and_sit": {
  "priority": 12,
  "min_look_count": 2,
  "max_look_count": 5,
  "min_look_time": 80,
  "max_look_time": 100,
  "probability": 0.001
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Look Around And Sit Behavior
 * (minecraft:behavior.random_look_around_and_sit)
 * Allows the mob to randomly sit and look around for a duration. Note:
 * Must have a sitting animation set up to use this.
 */
export default interface MinecraftBehaviorRandomLookAroundAndSit {

  /**
   * @remarks
   * If the goal should continue to be used as long as the mob is
   * leashed.
   * 
   * Sample Values:
   * Camel: true
   *
   */
  continue_if_leashed: boolean;

  /**
   * @remarks
   * The mob will stay sitting on reload.
   * 
   * Sample Values:
   * Camel: true
   *
   */
  continue_sitting_on_reload: boolean;

  /**
   * @remarks
   * The rightmost angle a mob can look at on the horizontal plane with
   * respect to its initial facing direction.
   * 
   * Sample Values:
   * Camel: 30
   *
   */
  max_angle_of_view_horizontal: number;

  /**
   * @remarks
   * The max amount of unique looks a mob will have while looking 
   * around.
   * 
   * Sample Values:
   * Camel: 5
   *
   *
   */
  max_look_count: number;

  /**
   * @remarks
   * The max amount of time (in ticks) a mob will stay looking at a
   * direction while looking around.
   * 
   * Sample Values:
   * Camel: 100
   *
   *
   */
  max_look_time: number;

  /**
   * @remarks
   * The leftmost angle a mob can look at on the horizontal plane with
   * respect to its initial facing direction.
   * 
   * Sample Values:
   * Camel: -30
   *
   */
  min_angle_of_view_horizontal: number;

  /**
   * @remarks
   * The min amount of unique looks a mob will have while looking 
   * around.
   * 
   * Sample Values:
   * Camel: 2
   *
   *
   */
  min_look_count: number;

  /**
   * @remarks
   * The min amount of time (in ticks) a mob will stay looking at a
   * direction while looking around.
   * 
   * Sample Values:
   * Camel: 80
   *
   *
   */
  min_look_time: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Camel: 4
   *
   * Fox: 12
   *
   */
  priority: number;

  /**
   * @remarks
   * The probability of randomly looking around/sitting.
   * 
   * Sample Values:
   * Camel: 0.001
   *
   *
   */
  probability: number;

  /**
   * @remarks
   * The cooldown in seconds before the goal can be used again.
   * 
   * Sample Values:
   * Camel: 5
   *
   */
  random_look_around_cooldown: number;

}