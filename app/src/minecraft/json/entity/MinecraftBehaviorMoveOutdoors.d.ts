// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_outdoors
 * 
 * minecraft:behavior.move_outdoors Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.move_outdoors": {
  "priority": 2,
  "speed_multiplier": 0.8,
  "timeout_cooldown": 8
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move Outdoors Behavior (minecraft:behavior.move_outdoors)
 * Allows this entity to move outdoors.
 */
export default interface MinecraftBehaviorMoveOutdoors {

  /**
   * @remarks
   * The radius away from the target block to count as reaching the
   * goal.
   */
  goal_radius: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 2
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * The amount of times to try finding a random outdoors position before
   * failing.
   */
  search_count: number;

  /**
   * @remarks
   * The y range to search for an outdoors position for.
   */
  search_height: number;

  /**
   * @remarks
   * The x and z range to search for an outdoors position for.
   */
  search_range: number;

  /**
   * @remarks
   * The movement speed modifier to apply to the entity while it is
   * moving outdoors.
   * 
   * Sample Values:
   * Villager v2: 0.8
   *
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The cooldown time in seconds before the goal can be reused after
   * pathfinding fails
   * 
   * Sample Values:
   * Villager v2: 8
   *
   *
   */
  timeout_cooldown: number;

}