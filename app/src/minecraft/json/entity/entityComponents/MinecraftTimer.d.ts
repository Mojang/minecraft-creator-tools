// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:timer
 * 
 * minecraft:timer Samples

Gray Zombie Leader - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/gray_zombie_leader.behavior.json

"minecraft:timer": {
  "looping": false,
  "time": 30,
  "time_down_event": {
    "event": "minecraft:convert_to_drowned"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Timer (minecraft:timer)
 * Adds a timer after which an event will fire.
 */
export default interface MinecraftTimer {

  /**
   * @remarks
   * If true, the timer will restart every time after it fires.
   */
  looping?: boolean;

  /**
   * @remarks
   * This is a list of objects, representing one value in seconds that
   * can be picked before firing the event and an optional weight.
   * Incompatible with time.
   */
  random_time_choices?: string[];

  /**
   * @remarks
   * If true, the amount of time on the timer will be random between the
   * min and max values specified in time.
   */
  randomInterval?: boolean;

  /**
   * @remarks
   * Amount of time in seconds for the timer. Can be specified as a
   * number or a pair of numbers (min and max). Incompatible with
   * random_time_choices.
   * 
   * Sample Values:
   * Gray Zombie Leader: 30
   *
   */
  time?: number[];

  /**
   * @remarks
   * Event to fire when the time on the timer runs out.
   * 
   * Sample Values:
   * Gray Zombie Leader: {"event":"minecraft:convert_to_drowned"}
   *
   */
  time_down_event?: jsoncommon.MinecraftEventTrigger;

}