// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.fertilize_farm_block
 * 
 * minecraft:behavior.fertilize_farm_block Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.fertilize_farm_block": {
  "priority": 8
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Fertilize Farm Block Behavior
 * (minecraft:behavior.fertilize_farm_block)
 * Allows the mob to search within an area for a growable crop
 * block. If found, the mob will use any available fertilizer in
 * their inventory on the crop. This goal will not execute if the
 * mob does not have a fertilizer item in its inventory.
 */
export default interface MinecraftBehaviorFertilizeFarmBlock {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached it's
   * target position.
   */
  goal_radius?: number;

  /**
   * @remarks
   * The maximum number of times the mob will use fertilzer on the
   * target block.
   */
  max_fertilizer_usage?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 8
   *
   */
  priority?: number;

  /**
   * @remarks
   * The maximum amount of time in seconds that the goal can take
   * before searching again. The time is chosen between 0 and this
   * number.
   */
  search_cooldown_max_seconds?: number;

  /**
   * @remarks
   * The number of randomly selected blocks each tick that the mob
   * will check within its search range and height for a valid block to
   * move to. A value of 0 will have the mob check every block within
   * range in one tick.
   */
  search_count?: number;

  /**
   * @remarks
   * The Height in blocks the mob will search within to find a
   * valid target position.
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks the mob will search within to find a
   * valid target position.
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this Goal.
   */
  speed_multiplier?: number;

}