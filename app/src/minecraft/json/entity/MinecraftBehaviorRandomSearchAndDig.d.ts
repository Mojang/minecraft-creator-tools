// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_search_and_dig
 * 
 * minecraft:behavior.random_search_and_dig Samples

Sniffer - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/sniffer.json

"minecraft:behavior.random_search_and_dig": {
  "priority": 5,
  "speed_multiplier": 1.25,
  "find_valid_position_retries": 5,
  "target_blocks": [
    "minecraft:dirt",
    "minecraft:coarse_dirt",
    "minecraft:grass",
    "minecraft:podzol",
    "minecraft:dirt_with_roots",
    "minecraft:moss_block",
    "minecraft:pale_moss_block",
    "minecraft:mud",
    "minecraft:muddy_mangrove_roots"
  ],
  "goal_radius": 2,
  "search_range_xz": 20,
  "search_range_y": 3,
  "cooldown_range": 0,
  "digging_duration_range": [
    8,
    10
  ],
  "item_table": "loot_tables/gameplay/entities/sniffer_seeds.json",
  "spawn_item_after_seconds": 6,
  "spawn_item_pos_offset": 2.25,
  "on_searching_start": {
    "event": "on_searching_start",
    "target": "self"
  },
  "on_fail_during_searching": {
    "event": "on_fail_during_searching",
    "target": "self"
  },
  "on_digging_start": {
    "event": "on_digging_start",
    "target": "self"
  },
  "on_item_found": {
    "event": "on_item_found",
    "target": "self"
  },
  "on_fail_during_digging": {
    "event": "on_fail_during_digging",
    "target": "self"
  },
  "on_success": {
    "event": "on_search_and_digging_success",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Search And Dig Behavior
 * (minecraft:behavior.random_search_and_dig)
 * Allows this entity to locate a random target block that it can
 * path find to. Once found, the entity will move towards it and
 * dig up an item. [Default target block types: Dirt, Grass, Podzol,
 * DirtWithRoots, MossBlock, Mud, MuddyMangroveRoots].
 */
export default interface MinecraftBehaviorRandomSearchAndDig {

  /**
   * @remarks
   * Goal cooldown range in seconds.
   */
  cooldown_range: number[];

  /**
   * @remarks
   * Digging duration in seconds.
   * 
   * Sample Values:
   * Sniffer: [8,10]
   *
   */
  digging_duration_range: number[];

  /**
   * @remarks
   * Amount of retries to find a valid target position within search
   * range.
   * 
   * Sample Values:
   * Sniffer: 5
   *
   */
  find_valid_position_retries: number;

  /**
   * @remarks
   * Distance in blocks within the entity to considers it has reached
   * it's target position.
   * 
   * Sample Values:
   * Sniffer: 2
   *
   */
  goal_radius: number;

  /**
   * @remarks
   * File path relative to the resource pack root for items to spawn
   * list (loot table format).
   * 
   * Sample Values:
   * Sniffer: "loot_tables/gameplay/entities/sniffer_seeds.json"
   *
   */
  item_table: string;

  /**
   * @remarks
   * Event to run when the goal ends searching has begins 
   * digging.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_digging_start","target":"self"}
   *
   */
  on_digging_start: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run when the goal failed while in digging state.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_fail_during_digging","target":"self"}
   *
   */
  on_fail_during_digging: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run when the goal failed while in searching state.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_fail_during_searching","target":"self"}
   *
   */
  on_fail_during_searching: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run when the goal find a item.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_item_found","target":"self"}
   *
   */
  on_item_found: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run when the goal starts searching.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_searching_start","target":"self"}
   *
   */
  on_searching_start: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to run when searching and digging has ended.
   * 
   * Sample Values:
   * Sniffer: {"event":"on_search_and_digging_success","target":"self"}
   *
   */
  on_success: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Sniffer: 5
   *
   */
  priority: number;

  /**
   * @remarks
   * Width and length of the volume around the entity used to find a
   * valid target position
   * 
   * Sample Values:
   * Sniffer: 20
   *
   */
  search_range_xz: number;

  /**
   * @remarks
   * Height of the volume around the entity used to find a valid target
   * position
   * 
   * Sample Values:
   * Sniffer: 3
   *
   */
  search_range_y: number;

  /**
   * @remarks
   * Digging duration before spawning item in seconds.
   * 
   * Sample Values:
   * Sniffer: 6
   *
   */
  spawn_item_after_seconds: number;

  /**
   * @remarks
   * Distance to offset the item's spawn location in the direction the
   * mob is facing.
   * 
   * Sample Values:
   * Sniffer: 2.25
   *
   */
  spawn_item_pos_offset: number;

  /**
   * @remarks
   * Searching movement speed multiplier.
   * 
   * Sample Values:
   * Sniffer: 1.25
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * List of target block types the goal will look to dig on.
   * Overrides the default list.
   * 
   * Sample Values:
   * Sniffer: ["minecraft:dirt","minecraft:coarse_dirt","minecraft:grass","minecraft:podzol","minecraft:dirt_with_roots","minecraft:moss_block","minecraft:pale_moss_block","minecraft:mud","minecraft:muddy_mangrove_roots"]
   *
   */
  target_blocks: string[];

  /**
   * @remarks
   * Dig target position offset from the feet position of the mob in
   * their facing direction.
   */
  target_dig_position_offset: number;

}