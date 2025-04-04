// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.sleep
 * 
 * minecraft:behavior.sleep Samples

Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.sleep/: 
"minecraft:behavior.sleep": {}

 * At /minecraft:entity/component_groups/bed_schedule_villager/minecraft:behavior.sleep/: 
"minecraft:behavior.sleep": {
  "priority": 3,
  "goal_radius": 1.5,
  "speed_multiplier": 0.6,
  "sleep_collider_height": 0.3,
  "sleep_collider_width": 1,
  "sleep_y_offset": 0.6,
  "timeout_cooldown": 10
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Sleep Behavior (minecraft:behavior.sleep)
 * Allows mobs that own a bed to in a village to move to and sleep in
 * it.
 */
export default interface MinecraftBehaviorSleep {

  /**
   * @remarks
   * If true, the mob will be able to use the sleep goal if riding
   * something
   */
  can_sleep_while_riding: boolean;

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   */
  cooldown_time: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager V2: 1.5
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
   * Villager V2: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * The height of the mob's collider while sleeping
   * 
   * Sample Values:
   * Villager V2: 0.3
   *
   */
  sleep_collider_height: number;

  /**
   * @remarks
   * The width of the mob's collider while sleeping
   * 
   * Sample Values:
   * Villager V2: 1
   *
   */
  sleep_collider_width: number;

  /**
   * @remarks
   * The y offset of the mob's collider while sleeping
   * 
   * Sample Values:
   * Villager V2: 0.6
   *
   */
  sleep_y_offset: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Villager V2: 0.6
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The cooldown time in seconds before the goal can be reused after a
   * internal failure or timeout condition
   * 
   * Sample Values:
   * Villager V2: 10
   *
   */
  timeout_cooldown: number;

}