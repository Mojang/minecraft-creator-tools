// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:block_sensor
 * 
 * minecraft:block_sensor Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:block_sensor": {
  "sensor_radius": 16,
  "sources": [
    {
      "test": "has_silk_touch",
      "subject": "other",
      "value": false
    }
  ],
  "on_break": [
    {
      "block_list": [
        "minecraft:beehive",
        "minecraft:bee_nest"
      ],
      "on_block_broken": "hive_destroyed"
    }
  ]
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:block_sensor": {
  "sensor_radius": 16,
  "on_break": [
    {
      "block_list": [
        "minecraft:gold_block",
        "minecraft:gilded_blackstone",
        "minecraft:nether_gold_ore",
        "minecraft:deepslate_gold_ore",
        "minecraft:raw_gold_block",
        "minecraft:gold_ore",
        "minecraft:chest",
        "minecraft:trapped_chest",
        "minecraft:ender_chest",
        "minecraft:barrel",
        "minecraft:white_shulker_box",
        "minecraft:orange_shulker_box",
        "minecraft:magenta_shulker_box",
        "minecraft:light_blue_shulker_box",
        "minecraft:yellow_shulker_box",
        "minecraft:lime_shulker_box",
        "minecraft:pink_shulker_box",
        "minecraft:gray_shulker_box",
        "minecraft:light_gray_shulker_box",
        "minecraft:cyan_shulker_box",
        "minecraft:purple_shulker_box",
        "minecraft:blue_shulker_box",
        "minecraft:brown_shulker_box",
        "minecraft:green_shulker_box",
        "minecraft:red_shulker_box",
        "minecraft:black_shulker_box",
        "minecraft:undyed_shulker_box"
      ],
      "on_block_broken": "important_block_destroyed_event"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Block Sensor (minecraft:block_sensor)
 * Fires off a specified event when a block in the block list is
 * broken within the sensor range.
 */
export default interface MinecraftBlockSensor {

  /**
   * @remarks
   * List of blocks to watch for being broken to fire off a
   * specified event. If a block is in multiple lists, multiple events
   * will fire.
   * 
   * Sample Values:
   * Bee: [{"block_list":["minecraft:beehive","minecraft:bee_nest"],"on_block_broken":"hive_destroyed"}]
   *
   * Piglin: [{"block_list":["minecraft:gold_block","minecraft:gilded_blackstone","minecraft:nether_gold_ore","minecraft:deepslate_gold_ore","minecraft:raw_gold_block","minecraft:gold_ore","minecraft:chest","minecraft:trapped_chest","minecraft:ender_chest","minecraft:barrel","minecraft:white_shulker_box","minecraft:orange_shulker_box","minecraft:magenta_shulker_box","minecraft:light_blue_shulker_box","minecraft:yellow_shulker_box","minecraft:lime_shulker_box","minecraft:pink_shulker_box","minecraft:gray_shulker_box","minecraft:light_gray_shulker_box","minecraft:cyan_shulker_box","minecraft:purple_shulker_box","minecraft:blue_shulker_box","minecraft:brown_shulker_box","minecraft:green_shulker_box","minecraft:red_shulker_box","minecraft:black_shulker_box","minecraft:undyed_shulker_box"],"on_block_broken":"important_block_destroyed_event"}]
   *
   */
  on_break: string[];

  /**
   * @remarks
   * The maximum radial distance in which a specified block can be
   * detected. The biggest radius is 32.0.
   * 
   * Sample Values:
   * Bee: 16
   *
   *
   */
  sensor_radius: number;

  /**
   * @remarks
   * List of sources that break the block to listen for. If none are
   * specified, all block breaks will be detected.
   * 
   * Sample Values:
   * Bee: [{"test":"has_silk_touch","subject":"other","value":false}]
   *
   */
  sources: string[];

}