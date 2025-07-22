// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.avoid_block
 * 
 * minecraft:behavior.avoid_block Samples

Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:behavior.avoid_block": {
  "priority": 1,
  "tick_interval": 5,
  "search_range": 8,
  "search_height": 4,
  "walk_speed_modifier": 1,
  "sprint_speed_modifier": 1,
  "avoid_block_sound": "retreat",
  "sound_interval": {
    "range_min": 2,
    "range_max": 5
  },
  "target_selection_method": "nearest",
  "target_blocks": [
    "minecraft:warped_fungus",
    "minecraft:portal",
    "minecraft:respawn_anchor"
  ],
  "on_escape": [
    {
      "event": "escaped_event",
      "target": "self"
    }
  ]
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.avoid_block": {
  "priority": 9,
  "tick_interval": 5,
  "search_range": 8,
  "search_height": 4,
  "sprint_speed_modifier": 1.1,
  "target_selection_method": "nearest",
  "target_blocks": [
    "minecraft:soul_fire",
    "minecraft:soul_lantern",
    "minecraft:soul_torch",
    "minecraft:item.soul_campfire"
  ],
  "avoid_block_sound": "retreat",
  "sound_interval": {
    "range_min": 2,
    "range_max": 5
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Avoid Block Behavior (minecraft:behavior.avoid_block)
 * Allows this entity to avoid certain blocks.
 */
export default interface MinecraftBehaviorAvoidBlock {

  /**
   * @remarks
   * The sound event to play when the mob is avoiding a block.
   * 
   * Sample Values:
   * Hoglin: "retreat"
   *
   *
   */
  avoid_block_sound: string;

  /**
   * @remarks
   * Escape trigger.
   * 
   * Sample Values:
   * Hoglin: [{"event":"escaped_event","target":"self"}]
   *
   */
  on_escape: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Hoglin: 1
   *
   * Piglin: 9
   *
   */
  priority: number;

  /**
   * @remarks
   * Maximum distance to look for a block in y.
   * 
   * Sample Values:
   * Hoglin: 4
   *
   *
   */
  search_height: number;

  /**
   * @remarks
   * Maximum distance to look for a block in xz.
   * 
   * Sample Values:
   * Hoglin: 8
   *
   *
   */
  search_range: number;

  /**
   * @remarks
   * The range of time in seconds to randomly wait before playing the
   * sound again.
   * 
   * Sample Values:
   * Hoglin: {"range_min":2,"range_max":5}
   *
   *
   */
  sound_interval: number[];

  /**
   * @remarks
   * Modifier for sprint speed. 1.0 means keep the regular speed, while
   * higher numbers make the sprint speed faster.
   * 
   * Sample Values:
   * Hoglin: 1
   *
   * Piglin: 1.1
   *
   */
  sprint_speed_modifier: number;

  /**
   * @remarks
   * List of block types this mob avoids.
   * 
   * Sample Values:
   * Hoglin: ["minecraft:warped_fungus","minecraft:portal","minecraft:respawn_anchor"]
   *
   * Piglin: ["minecraft:soul_fire","minecraft:soul_lantern","minecraft:soul_torch","minecraft:item.soul_campfire"]
   *
   */
  target_blocks: string[];

  /**
   * @remarks
   * Block search method.
   * 
   * Sample Values:
   * Hoglin: "nearest"
   *
   *
   */
  target_selection_method: string;

  /**
   * @remarks
   * Should start tick interval.
   * 
   * Sample Values:
   * Hoglin: 5
   *
   *
   */
  tick_interval: number;

  /**
   * @remarks
   * Modifier for walking speed. 1.0 means keep the regular speed, while
   * higher numbers make the walking speed faster.
   * 
   * Sample Values:
   * Hoglin: 1
   *
   */
  walk_speed_modifier: number;

}