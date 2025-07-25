// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.harvest_farm_block
 * 
 * minecraft:behavior.harvest_farm_block Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.harvest_farm_block/: 
"minecraft:behavior.harvest_farm_block": {}

 * At /minecraft:entity/component_groups/work_schedule_farmer/minecraft:behavior.harvest_farm_block/: 
"minecraft:behavior.harvest_farm_block": {
  "priority": 7
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.harvest_farm_block": {
  "priority": 9,
  "speed_multiplier": 0.5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Harvest Farm Block Behavior 
 * (minecraft:behavior.harvest_farm_block)
 * Allows the entity to search within an area for farmland with air
 * above it. If found, the entity will replace the air block by
 * planting a seed item from its inventory on the farmland block. This
 * goal will not execute if the entity does not have an item in
 * its inventory.
 */
export default interface MinecraftBehaviorHarvestFarmBlock {

  /**
   * @remarks
   * Distance in blocks within the entity considers it has reached it's
   * target position. 
   */
  goal_radius: number;

  /**
   * @remarks
   * The maximum amount of time in seconds that the goal can take
   * before searching for the first harvest block. The time is
   * chosen between 0 and this number.
   */
  max_seconds_before_search: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 7
   *
   * Villager: 9
   *
   */
  priority: number;

  /**
   * @remarks
   * The maximum amount of time in seconds that the goal can take
   * before searching again, after failing to find a a harvest block
   * already. The time is chosen between 0 and this number.
   */
  search_cooldown_max_seconds: number;

  /**
   * @remarks
   * The number of randomly selected blocks each tick that the entity
   * will check within its search range and height for a valid block to
   * move to. A value of 0 will have the mob check every block within
   * range in one tick.
   */
  search_count: number;

  /**
   * @remarks
   * The Height in blocks the entity will search within to find a
   * valid target position.
   */
  search_height: number;

  /**
   * @remarks
   * The distance in blocks the entity will search within to find a
   * valid target position.
   */
  search_range: number;

  /**
   * @remarks
   * The amount of time in seconds that the goal will cooldown after a
   * successful reap/sow, before it can start again.
   */
  seconds_until_new_task: number;

  /**
   * @remarks
   * Movement speed multiplier of the entity when using this 
   * Goal.
   * 
   * Sample Values:
   * Villager: 0.5
   *
   */
  speed_multiplier: number;

}