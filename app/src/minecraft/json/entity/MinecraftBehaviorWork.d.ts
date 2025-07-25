// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.work
 * 
 * minecraft:behavior.work Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.work/: 
"minecraft:behavior.work": {}

 * At /minecraft:entity/component_groups/work_schedule_villager/minecraft:behavior.work/: 
"minecraft:behavior.work": {
  "priority": 7,
  "active_time": 250,
  "speed_multiplier": 0.5,
  "goal_cooldown": 200,
  "sound_delay_min": 100,
  "sound_delay_max": 200,
  "can_work_in_rain": false,
  "work_in_rain_tolerance": 100,
  "on_arrival": {
    "event": "minecraft:resupply_trades",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Work Behavior (minecraft:behavior.work)
 * Allows the NPC to use the POI.
 */
export default interface MinecraftBehaviorWork {

  /**
   * @remarks
   * The amount of ticks the NPC will stay in their the work 
   * location
   * 
   * Sample Values:
   * Villager v2: 250
   *
   */
  active_time: number;

  /**
   * @remarks
   * If true, this entity can work when their jobsite POI is being
   * rained on.
   */
  can_work_in_rain: boolean;

  /**
   * @remarks
   * The amount of ticks the goal will be on cooldown before it can
   * be used again
   * 
   * Sample Values:
   * Villager v2: 200
   *
   */
  goal_cooldown: number;

  /**
   * @remarks
   * Event to run when the mob reaches their jobsite.
   * 
   * Sample Values:
   * Villager v2: {"event":"minecraft:resupply_trades","target":"self"}
   *
   */
  on_arrival: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 7
   *
   */
  priority: number;

  /**
   * @remarks
   * The max interval in which a sound will play.
   * 
   * Sample Values:
   * Villager v2: 200
   *
   */
  sound_delay_max: number;

  /**
   * @remarks
   * The min interval in which a sound will play.
   * 
   * Sample Values:
   * Villager v2: 100
   *
   */
  sound_delay_min: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Villager v2: 0.5
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * If "can_work_in_rain" is false, this is the maximum number of
   * ticks left in the goal where rain will not interrupt the 
   * goal
   * 
   * Sample Values:
   * Villager v2: 100
   *
   */
  work_in_rain_tolerance: number;

}