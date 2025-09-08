// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.work_composter
 * 
 * minecraft:behavior.work_composter Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.work_composter/: 
"minecraft:behavior.work_composter": {}

 * At /minecraft:entity/component_groups/work_schedule_farmer/minecraft:behavior.work_composter/: 
"minecraft:behavior.work_composter": {
  "priority": 9,
  "active_time": 250,
  "speed_multiplier": 0.5,
  "goal_cooldown": 200,
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
 * Work Composter Behavior (minecraft:behavior.work_composter)
 * Allows the NPC to use the composter POI to convert excess seeds
 * into bone meal.
 */
export default interface MinecraftBehaviorWorkComposter {

  /**
   * @remarks
   * The amount of ticks the NPC will stay in their the work 
   * location
   * 
   * Sample Values:
   * Villager v2: 250
   *
   */
  active_time?: number;

  /**
   * @remarks
   * The maximum number of times the mob will interact with the
   * composter.
   */
  block_interaction_max?: number;

  /**
   * @remarks
   * Determines whether the mob can empty a full composter.
   */
  can_empty_composter?: boolean;

  /**
   * @remarks
   * Determines whether the mob can add items to a composter given that
   * it is not full.
   */
  can_fill_composter?: boolean;

  /**
   * @remarks
   * If true, this entity can work when their jobsite POI is being
   * rained on.
   */
  can_work_in_rain?: boolean;

  /**
   * @remarks
   * The amount of ticks the goal will be on cooldown before it can
   * be used again
   * 
   * Sample Values:
   * Villager v2: 200
   *
   */
  goal_cooldown?: number;

  /**
   * @remarks
   * The maximum number of items which can be added to the composter per
   * block interaction.
   */
  items_per_use_max?: number;

  /**
   * @remarks
   * Limits the amount of each compostable item the mob can use. Any
   * amount held over this number will be composted if possible
   */
  min_item_count?: number;

  /**
   * @remarks
   * Event to run when the mob reaches their jobsite.
   * 
   * Sample Values:
   * Villager v2: {"event":"minecraft:resupply_trades","target":"self"}
   *
   */
  on_arrival?: jsoncommon.MinecraftEventTrigger;

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
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Villager v2: 0.5
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * The maximum interval in which the mob will interact with the
   * composter.
   */
  use_block_max?: number;

  /**
   * @remarks
   * The minimum interval in which the mob will interact with the
   * composter.
   */
  use_block_min?: number;

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
  work_in_rain_tolerance?: number;

}