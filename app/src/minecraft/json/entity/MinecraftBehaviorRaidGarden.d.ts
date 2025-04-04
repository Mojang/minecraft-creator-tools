// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.raid_garden
 * 
 * minecraft:behavior.raid_garden Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.raid_garden": {
  "priority": 12,
  "blocks": [
    "minecraft:sweet_berry_bush",
    "minecraft:cave_vines_head_with_berries",
    "minecraft:cave_vines_body_with_berries"
  ],
  "speed_multiplier": 1.2,
  "search_range": 12,
  "search_height": 2,
  "goal_radius": 0.8,
  "max_to_eat": 0,
  "initial_eat_delay": 2
}


Rabbit - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/rabbit.json

"minecraft:behavior.raid_garden": {
  "priority": 5,
  "blocks": [
    "minecraft:carrots"
  ],
  "search_range": 16,
  "goal_radius": 1,
  "speed_multiplier": 0.6
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Raid Garden Behavior (minecraft:behavior.raid_garden)
 * Allows the mob to eat/raid crops out of farms until they are
 * full.
 */
export default interface MinecraftBehaviorRaidGarden {

  /**
   * @remarks
   * Blocks that the mob is looking for to eat/raid
   * 
   * Sample Values:
   * Fox: ["minecraft:sweet_berry_bush","minecraft:cave_vines_head_with_berries","minecraft:cave_vines_body_with_berries"]
   *
   * Rabbit: ["minecraft:carrots"]
   *
   */
  blocks: string[];

  /**
   * @remarks
   * Time in seconds between each time it eats/raids
   */
  eat_delay: number;

  /**
   * @remarks
   * Amount of time in seconds before this mob wants to eat/raid again
   * after eating its maximum
   */
  full_delay: number;

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Fox: 0.8
   *
   * Rabbit: 1
   *
   */
  goal_radius: number;

  /**
   * @remarks
   * Time in seconds before starting to eat/raid once it arrives at
   * it
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  initial_eat_delay: number;

  /**
   * @remarks
   * Maximum number of crops this entity wants to eat/raid. If set to
   * zero or less then it doesn't have a maximum
   */
  max_to_eat: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Fox: 12
   *
   * Rabbit: 5
   *
   */
  priority: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  search_height: number;

  /**
   * @remarks
   * Distance in blocks the mob will look for crops to eat
   * 
   * Sample Values:
   * Fox: 12
   *
   * Rabbit: 16
   *
   */
  search_range: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Fox: 1.2
   *
   * Rabbit: 0.6
   *
   */
  speed_multiplier: number;

}