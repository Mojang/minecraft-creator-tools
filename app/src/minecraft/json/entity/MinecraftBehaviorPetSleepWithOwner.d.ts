// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.pet_sleep_with_owner
 * 
 * minecraft:behavior.pet_sleep_with_owner Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.pet_sleep_with_owner": {
  "priority": 2,
  "speed_multiplier": 1.2,
  "search_radius": 10,
  "search_height": 10,
  "goal_radius": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Pet Sleep With Owner Behavior
 * (minecraft:behavior.pet_sleep_with_owner)
 * Allows the pet mob to move onto a bed with its owner while
 * sleeping.
 */
export default interface MinecraftBehaviorPetSleepWithOwner {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Cat: 1
   *
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
   * Cat: 2
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * Height in blocks from the owner the pet can be to sleep with
   * owner.
   * 
   * Sample Values:
   * Cat: 10
   *
   *
   */
  search_height: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Cat: 10
   *
   *
   */
  search_radius: number;

  /**
   * @remarks
   * The distance in blocks from the owner the pet can be to sleep with
   * owner.
   */
  search_range: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Cat: 1.2
   *
   *
   */
  speed_multiplier: number;

}