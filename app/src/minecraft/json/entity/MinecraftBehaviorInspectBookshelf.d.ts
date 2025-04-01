// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.inspect_bookshelf
 * 
 * minecraft:behavior.inspect_bookshelf Samples

Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.inspect_bookshelf/: 
"minecraft:behavior.inspect_bookshelf": {}

 * At /minecraft:entity/component_groups/work_schedule_librarian/minecraft:behavior.inspect_bookshelf/: 
"minecraft:behavior.inspect_bookshelf": {
  "priority": 8,
  "speed_multiplier": 0.6,
  "search_range": 4,
  "search_height": 3,
  "goal_radius": 0.8,
  "search_count": 0
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Inspect Bookshelf Behavior 
 * (minecraft:behavior.inspect_bookshelf)
 * Allows the mob to inspect bookshelves.
 */
export default interface MinecraftBehaviorInspectBookshelf {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Villager V2: 0.8
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
   * Villager V2: 8
   *
   */
  priority: number;

  /**
   * @remarks
   * The number of blocks each tick that the mob will check within its
   * search range and height for a valid block to move to. A value of
   * 0 will have the mob check every block within range in one 
   * tick
   */
  search_count: number;

  /**
   * @remarks
   * The height that the mob will search for bookshelves
   * 
   * Sample Values:
   * Villager V2: 3
   *
   */
  search_height: number;

  /**
   * @remarks
   * Distance in blocks the mob will look for books to inspect
   * 
   * Sample Values:
   * Villager V2: 4
   *
   */
  search_range: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Villager V2: 0.6
   *
   */
  speed_multiplier: number;

}