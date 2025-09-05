// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.explore_outskirts
 * 
 * minecraft:behavior.explore_outskirts Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.explore_outskirts/: 
"minecraft:behavior.explore_outskirts": {}

 * At /minecraft:entity/component_groups/wander_schedule_villager/minecraft:behavior.explore_outskirts/: 
"minecraft:behavior.explore_outskirts": {
  "priority": 9,
  "next_xz": 5,
  "next_y": 3,
  "min_wait_time": 3,
  "max_wait_time": 10,
  "max_travel_time": 60,
  "speed_multiplier": 0.6,
  "explore_dist": 6,
  "min_perimeter": 1,
  "min_dist_from_target": 2.5,
  "timer_ratio": 2,
  "dist_from_boundary": [
    5,
    0,
    5
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Explore Outskirts Behavior 
 * (minecraft:behavior.explore_outskirts)
 * Allows the entity to first travel to a random point on the
 * outskirts of the village, and then explore random points within a
 * small distance.
 */
export default interface MinecraftBehaviorExploreOutskirts {

  /**
   * @remarks
   * The distance from the boundary the villager must be within in
   * to explore the outskirts.
   * 
   * Sample Values:
   * Villager v2: [5,0,5]
   *
   */
  dist_from_boundary?: number[];

  /**
   * @remarks
   * Total distance in blocks the the entity will explore beyond the
   * village bounds when choosing its travel point.
   * 
   * Sample Values:
   * Villager v2: 6
   *
   */
  explore_dist?: number;

  /**
   * @remarks
   * This is the maximum amount of time an entity will attempt to
   * reach it's travel point on the outskirts of the village before the
   * goal exits.
   * 
   * Sample Values:
   * Villager v2: 60
   *
   */
  max_travel_time?: number;

  /**
   * @remarks
   * The wait time in seconds between choosing new explore points will
   * be chosen on a random interval between this value and the
   * minimum wait time. This value is also the total amount of time
   * the entity will explore random points before the goal stops.
   * 
   * Sample Values:
   * Villager v2: 10
   *
   */
  max_wait_time?: number;

  /**
   * @remarks
   * The entity must be within this distance for it to consider it
   * has successfully reached its target.
   * 
   * Sample Values:
   * Villager v2: 2.5
   *
   */
  min_dist_from_target?: number;

  /**
   * @remarks
   * The minimum perimeter of the village required to run this 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 1
   *
   */
  min_perimeter?: number;

  /**
   * @remarks
   * The wait time in seconds between choosing new explore points will
   * be chosen on a random interval between this value and the
   * maximum wait time.
   * 
   * Sample Values:
   * Villager v2: 3
   *
   */
  min_wait_time?: number;

  /**
   * @remarks
   * A new explore point will randomly be chosen within this XZ
   * distance of the current target position when navigation has
   * finished and the wait timer has elapsed.
   * 
   * Sample Values:
   * Villager v2: 5
   *
   */
  next_xz?: number;

  /**
   * @remarks
   * A new explore point will randomly be chosen within this Y
   * distance of the current target position when navigation has
   * finished and the wait timer has elapsed.
   * 
   * Sample Values:
   * Villager v2: 3
   *
   */
  next_y?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 9
   *
   */
  priority?: number;

  /**
   * @remarks
   * The multiplier for speed while using this goal. 1.0 maintains the
   * speed.
   * 
   * Sample Values:
   * Villager v2: 0.6
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Each new explore point will be chosen on a random interval between
   * the minimum and the maximum wait time, divided by this value. This
   * does not apply to the first explore point chosen when the goal
   * runs.
   * 
   * Sample Values:
   * Villager v2: 2
   *
   */
  timer_ratio?: number;

}