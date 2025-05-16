// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.float_tempt
 * 
 * minecraft:behavior.float_tempt Samples

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/component_groups/minecraft:unharnessed/minecraft:behavior.float_tempt/: 
"minecraft:behavior.float_tempt": {
  "priority": 4,
  "can_tempt_vertically": true,
  "items": [
    "minecraft:snowball",
    "minecraft:black_harness",
    "minecraft:blue_harness",
    "minecraft:brown_harness",
    "minecraft:cyan_harness",
    "minecraft:gray_harness",
    "minecraft:green_harness",
    "minecraft:light_blue_harness",
    "minecraft:light_gray_harness",
    "minecraft:lime_harness",
    "minecraft:magenta_harness",
    "minecraft:orange_harness",
    "minecraft:pink_harness",
    "minecraft:purple_harness",
    "minecraft:red_harness",
    "minecraft:white_harness",
    "minecraft:yellow_harness"
  ],
  "within_radius": 16,
  "stop_distance": 7,
  "on_tempt_end": {
    "event": "minecraft:on_stop_tempting"
  }
}

 * At /minecraft:entity/component_groups/minecraft:harnessed/minecraft:behavior.float_tempt/: 
"minecraft:behavior.float_tempt": {
  "priority": 5,
  "can_tempt_vertically": true,
  "items": [
    "minecraft:snowball"
  ],
  "within_radius": 16,
  "stop_distance": 7,
  "on_tempt_end": {
    "event": "minecraft:on_stop_tempting"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Float Tempt Behavior (minecraft:behavior.float_tempt)
 * Allows a mob to be tempted by a player holding a specific item.
 * Uses point-to-point movement. Designed for mobs that are
 * floating (e.g. use the "minecraft:navigation.float" 
 * component).
 */
export default interface MinecraftBehaviorFloatTempt {

  /**
   * @remarks
   * If true, the mob can stop being tempted if the player moves too
   * fast while close to this mob.
   */
  can_get_scared: boolean;

  /**
   * @remarks
   * If true, vertical distance to the player will be considered when
   * tempting.
   * 
   * Sample Values:
   * Happy Ghast: true
   *
   */
  can_tempt_vertically: boolean;

  /**
   * @remarks
   * If true, the mob can be tempted even if it has a passenger (i.e.
   * if being ridden).
   */
  can_tempt_while_ridden: boolean;

  /**
   * @remarks
   * List of items that can tempt the mob.
   * 
   * Sample Values:
   * Happy Ghast: ["minecraft:snowball","minecraft:black_harness","minecraft:blue_harness","minecraft:brown_harness","minecraft:cyan_harness","minecraft:gray_harness","minecraft:green_harness","minecraft:light_blue_harness","minecraft:light_gray_harness","minecraft:lime_harness","minecraft:magenta_harness","minecraft:orange_harness","minecraft:pink_harness","minecraft:purple_harness","minecraft:red_harness","minecraft:white_harness","minecraft:yellow_harness"], ["minecraft:snowball"]
   *
   */
  items: string[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Happy Ghast: {"event":"minecraft:on_stop_tempting"}
   *
   */
  on_tempt_end: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Happy Ghast: 4, 5
   *
   */
  priority: number;

  /**
   * @remarks
   * Range of random ticks to wait between tempt sounds.
   */
  sound_interval: number[];

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The distance at which the mob will stop following the 
   * player.
   * 
   * Sample Values:
   * Happy Ghast: 7
   *
   */
  stop_distance: number;

  /**
   * @remarks
   * Sound to play while the mob is being tempted.
   */
  tempt_sound: string;

  /**
   * @remarks
   * Distance in blocks this mob can get tempted by a player holding an
   * item they like.
   * 
   * Sample Values:
   * Happy Ghast: 16
   *
   */
  within_radius: number;

}