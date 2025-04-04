// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:destructible_by_mining
 * 
 * minecraft:destructible_by_mining Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:destructible_by_mining": {
  "seconds_to_destroy": 0.4
}


Block Orange Ore - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/basic_orange_ore/behavior_packs/basic_orange_ore/blocks/orange_ore.block.json

"minecraft:destructible_by_mining": {
  "seconds_to_destroy": 1
}


Luckyblock - https://github.com/microsoft/minecraft-samples/tree/main/lucky_block/version_1/behavior_packs/mike_luck/blocks/luckyblock.json

"minecraft:destructible_by_mining": {
  "seconds_to_destroy": 5,
  "item_specific_speeds": []
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Destructible By Mining (minecraft:destructible_by_mining)
 * Describes the destructible by mining properties for this block. If
 * set to true, the block will take the default number of seconds to
 * destroy. If set to false, this block is indestructible by
 * mining. If the component is omitted, the block will take the
 * default number of seconds to destroy.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftDestructibleByMining {

  /**
   * @remarks
   * Optional array of objects to describe item specific block destroy
   * speeds, each object contains an 'item' ItemDescriptor and a
   * 'destroy_speed' float. This array currently requires UpcomingFeatures
   * experiment to be enabled.
   * 
   * Sample Values:
   * Samples: "{ <br> "minecraft:destructible_by_mining": { <br> "seconds_to_destroy": 10, <br> "item_specific_speeds": [ <br> { <br> "item": { "tags": "q.any_tag('minecraft:is_pickaxe', 'minecraft:is_tool') " }, <br> "destroy_speed": 5.0 <br> } <br> ] <br> } <br>}", "{ <br> "minecraft:destructible_by_mining": { <br> "seconds_to_destroy": 10, <br> "item_specific_speeds": [ <br> { <br> "item": "minecraft:iron_pickaxe", <br> "destroy_speed": 5.0 <br> }, <br> { <br> "item": "minecraft:diamond_pickaxe", <br> "destroy_speed": 2.0 <br> } <br> ] <br> } <br>}"
   *
   * Luckyblock: []
   *
   */
  item_specific_speeds: MinecraftDestructibleByMiningItemSpecificSpeeds[];

  /**
   * @remarks
   * Sets the number of seconds it takes to destroy the block with
   * base equipment. Greater numbers result in greater mining 
   * times.
   * 
   * Sample Values:
   * Block Fabricator: 0.4
   *
   *
   * Block Orange Ore: 1
   *
   * Luckyblock: 5
   *
   */
  seconds_to_destroy: number;

}


/**
 * Optional array of objects to describe item specific block destroy
 * speeds, each object contains an 'item' ItemDescriptor and a
 * 'destroy_speed' float. This array currently requires UpcomingFeatures
 * experiment to be enabled.
 */
export interface MinecraftDestructibleByMiningItemSpecificSpeeds {

  /**
   * @remarks
   * Required. A destroy speed applied while using the defined 
   * 'item'.
   */
  destroy_speed: number;

  /**
   * @remarks
   * Required. A filter for the item used while mining.
   */
  item: MinecraftDestructibleByMiningItemSpecificSpeedsItem[];

}


/**
 * Optional array of objects to describe item specific block destroy
 * speeds, each object contains an 'item' ItemDescriptor and a
 * 'destroy_speed' float. This array currently requires UpcomingFeatures
 * experiment to be enabled.
 */
export interface MinecraftDestructibleByMiningItemSpecificSpeedsItem {

  tags: string;

}