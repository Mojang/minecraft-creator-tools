// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_block
 * 
 * minecraft:behavior.move_to_block Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/look_for_food/minecraft:behavior.move_to_block/: 
"minecraft:behavior.move_to_block": {
  "priority": 10,
  "tick_interval": 1,
  "start_chance": 0.5,
  "search_range": 6,
  "search_height": 4,
  "goal_radius": 1,
  "stay_duration": 20,
  "target_selection_method": "random",
  "target_offset": [
    0,
    0.25,
    0
  ],
  "target_block_filters": {
    "test": "is_waterlogged",
    "subject": "block",
    "operator": "==",
    "value": false
  },
  "target_blocks": [
    "minecraft:poppy",
    "minecraft:blue_orchid",
    "minecraft:allium",
    "minecraft:azure_bluet",
    "minecraft:red_tulip",
    "minecraft:orange_tulip",
    "minecraft:white_tulip",
    "minecraft:pink_tulip",
    "minecraft:oxeye_daisy",
    "minecraft:cornflower",
    "minecraft:lily_of_the_valley",
    "minecraft:dandelion",
    "minecraft:wither_rose",
    "minecraft:sunflower",
    "minecraft:lilac",
    "minecraft:rose_bush",
    "minecraft:peony",
    "minecraft:flowering_azalea",
    "minecraft:azalea_leaves_flowered",
    "minecraft:mangrove_propagule",
    "minecraft:pitcher_plant",
    "minecraft:torchflower",
    "minecraft:cherry_leaves",
    "minecraft:pink_petals",
    "minecraft:open_eyeblossom",
    "minecraft:wildflowers",
    "minecraft:cactus_flower"
  ],
  "on_stay_completed": [
    {
      "event": "collected_nectar",
      "target": "self"
    }
  ]
}

 * At /minecraft:entity/component_groups/find_hive/minecraft:behavior.move_to_block/: 
"minecraft:behavior.move_to_block": {
  "priority": 10,
  "search_range": 16,
  "search_height": 10,
  "tick_interval": 1,
  "goal_radius": 0.633,
  "target_blocks": [
    "bee_nest",
    "beehive"
  ],
  "on_reach": [
    {
      "event": "minecraft:bee_returned_to_hive",
      "target": "block"
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Block Behavior (minecraft:behavior.move_to_block)
 * Allows mob to move towards a block.
 */
export default interface MinecraftBehaviorMoveToBlock {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Bee: 1, 0.633
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * Event to run on block reached.
   * 
   * Sample Values:
   * Bee: [{"event":"minecraft:bee_returned_to_hive","target":"block"}]
   *
   */
  on_reach?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run on completing a stay of stay_duration at the 
   * block.
   * 
   * Sample Values:
   * Bee: [{"event":"collected_nectar","target":"self"}]
   *
   */
  on_stay_completed?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Bee: 10
   *
   */
  priority?: number;

  /**
   * @remarks
   * The height in blocks that the mob will look for the block.
   * 
   * Sample Values:
   * Bee: 4, 10
   *
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks that the mob will look for the block.
   * 
   * Sample Values:
   * Bee: 6, 16
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Chance to start the behavior (applied after each random
   * tick_interval).
   * 
   * Sample Values:
   * Bee: 0.5
   *
   */
  start_chance?: number;

  /**
   * @remarks
   * Number of ticks needed to complete a stay at the block.
   * 
   * Sample Values:
   * Bee: 20
   *
   */
  stay_duration?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: {"test":"is_waterlogged","subject":"block","operator":"==","value":false}
   *
   */
  target_block_filters?: MinecraftBehaviorMoveToBlockTargetBlockFilters;

  /**
   * @remarks
   * Block types to move to.
   * 
   * Sample Values:
   * Bee: ["minecraft:poppy","minecraft:blue_orchid","minecraft:allium","minecraft:azure_bluet","minecraft:red_tulip","minecraft:orange_tulip","minecraft:white_tulip","minecraft:pink_tulip","minecraft:oxeye_daisy","minecraft:cornflower","minecraft:lily_of_the_valley","minecraft:dandelion","minecraft:wither_rose","minecraft:sunflower","minecraft:lilac","minecraft:rose_bush","minecraft:peony","minecraft:flowering_azalea","minecraft:azalea_leaves_flowered","minecraft:mangrove_propagule","minecraft:pitcher_plant","minecraft:torchflower","minecraft:cherry_leaves","minecraft:pink_petals","minecraft:open_eyeblossom","minecraft:wildflowers","minecraft:cactus_flower"], ["bee_nest","beehive"]
   *
   */
  target_blocks?: string[];

  /**
   * @remarks
   * Offset to add to the selected target position.
   * 
   * Sample Values:
   * Bee: [0,0.25,0]
   *
   */
  target_offset?: number[];

  /**
   * @remarks
   * Kind of block to find fitting the specification. Valid values are
   * "random" and "nearest".
   * 
   * Sample Values:
   * Bee: "random"
   *
   */
  target_selection_method?: string;

  /**
   * @remarks
   * Average interval in ticks to try to run this behavior.
   * 
   * Sample Values:
   * Bee: 1
   *
   */
  tick_interval?: number;

}


/**
 * Target_block_filters (target_block_filters)
 */
export interface MinecraftBehaviorMoveToBlockTargetBlockFilters {

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: "=="
   *
   */
  operator?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: "block"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: "is_waterlogged"
   *
   */
  test?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: false
   *
   */
  value?: string;

}