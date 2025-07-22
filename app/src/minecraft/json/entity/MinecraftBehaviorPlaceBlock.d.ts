// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.place_block
 * 
 * minecraft:behavior.place_block Samples

Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:behavior.place_block": {
  "priority": 10,
  "xz_range": 1,
  "y_range": [
    0,
    2
  ],
  "chance": 0.0005
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Place Block Behavior (minecraft:behavior.place_block)
 */
export default interface MinecraftBehaviorPlaceBlock {

  /**
   * @remarks
   * If true, whether the goal is affected by the mob griefing game
   * rule.
   */
  affected_by_griefing_rule: boolean;

  /**
   * @remarks
   * Filters for if the entity should try to place its block. Self and
   * Target are set.
   */
  can_place: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Chance each tick for the entity to try and place a block.
   * 
   * Sample Values:
   * Enderman: 0.0005
   *
   */
  chance: number;

  /**
   * @remarks
   * Trigger ran if the entity does place its block. Self, Target, and
   * Block are set.
   */
  on_place: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Block descriptors for which blocks are valid to be placed from
   * the entity's carried item, if empty all blocks are valid.
   */
  placeable_carried_blocks: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Enderman: 10
   *
   */
  priority: number;

  /**
   * @remarks
   * Weighted block descriptors for which blocks should be randomly
   * placed, if empty the entity will try to place its carried block
   * from placeable_carried_blocks.
   */
  randomly_placeable_blocks: string[];

  /**
   * @remarks
   * XZ range from which the entity will try and place blocks in.
   * 
   * Sample Values:
   * Enderman: 1
   *
   */
  xz_range: number[];

  /**
   * @remarks
   * Y range from which the entity will try and place blocks in.
   * 
   * Sample Values:
   * Enderman: [0,2]
   *
   */
  y_range: number[];

}