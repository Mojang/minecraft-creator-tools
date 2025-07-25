// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.take_block
 * 
 * minecraft:behavior.take_block Samples

Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:behavior.take_block": {
  "priority": 11,
  "xz_range": 2,
  "y_range": [
    0,
    3
  ],
  "chance": 0.05,
  "blocks": [
    "dirt",
    "grass_block",
    "podzol",
    "coarse_dirt",
    "mycelium",
    "dirt_with_roots",
    "moss_block",
    "pale_moss_block",
    "muddy_mangrove_roots",
    "mud",
    "sand",
    "red_sand",
    "gravel",
    "brown_mushroom",
    "red_mushroom",
    "tnt",
    "cactus",
    "cactus_flower",
    "clay",
    "pumpkin",
    "carved_pumpkin",
    "melon_block",
    "crimson_fungus",
    "crimson_nylium",
    "crimson_roots",
    "warped_fungus",
    "warped_nylium",
    "warped_roots",
    "dandelion",
    "open_eyeblossom",
    "closed_eyeblossom",
    "poppy",
    "blue_orchid",
    "allium",
    "azure_bluet",
    "red_tulip",
    "orange_tulip",
    "white_tulip",
    "pink_tulip",
    "oxeye_daisy",
    "cornflower",
    "lily_of_the_valley",
    "wither_rose",
    "torchflower"
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Take Block Behavior (minecraft:behavior.take_block)
 */
export default interface MinecraftBehaviorTakeBlock {

  /**
   * @remarks
   * If true, whether the goal is affected by the mob griefing game
   * rule.
   */
  affected_by_griefing_rule: boolean;

  /**
   * @remarks
   * Block descriptors for which blocks are valid to be taken by the
   * entity, if empty all blocks are valid.
   * 
   * Sample Values:
   * Enderman: ["dirt","grass_block","podzol","coarse_dirt","mycelium","dirt_with_roots","moss_block","pale_moss_block","muddy_mangrove_roots","mud","sand","red_sand","gravel","brown_mushroom","red_mushroom","tnt","cactus","cactus_flower","clay","pumpkin","carved_pumpkin","melon_block","crimson_fungus","crimson_nylium","crimson_roots","warped_fungus","warped_nylium","warped_roots","dandelion","open_eyeblossom","closed_eyeblossom","poppy","blue_orchid","allium","azure_bluet","red_tulip","orange_tulip","white_tulip","pink_tulip","oxeye_daisy","cornflower","lily_of_the_valley","wither_rose","torchflower"]
   *
   */
  blocks: string[];

  /**
   * @remarks
   * Filters for if the entity should try to take a block. Self and
   * Target are set.
   */
  can_take: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Chance each tick for the entity to try and take a block.
   * 
   * Sample Values:
   * Enderman: 0.05
   *
   */
  chance: number;

  /**
   * @remarks
   * Trigger ran if the entity does take a block. Self, Target, and
   * Block are set.
   */
  on_take: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Enderman: 11
   *
   */
  priority: number;

  /**
   * @remarks
   * If true, whether the entity needs line of sight to the block they
   * are trying to take.
   */
  requires_line_of_sight: boolean;

  /**
   * @remarks
   * XZ range from which the entity will try and take blocks 
   * from.
   * 
   * Sample Values:
   * Enderman: 2
   *
   */
  xz_range: number[];

  /**
   * @remarks
   * Y range from which the entity will try and take blocks from.
   * 
   * Sample Values:
   * Enderman: [0,3]
   *
   */
  y_range: number[];

}