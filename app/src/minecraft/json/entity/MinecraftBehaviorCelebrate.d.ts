// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.celebrate
 * 
 * minecraft:behavior.celebrate Samples

Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.celebrate": {
  "priority": 5,
  "celebration_sound": "celebrate",
  "sound_interval": {
    "range_min": 2,
    "range_max": 7
  },
  "jump_interval": {
    "range_min": 1,
    "range_max": 3.5
  },
  "duration": 30,
  "on_celebration_end_event": {
    "event": "minecraft:stop_celebrating",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Celebrate Behavior (minecraft:behavior.celebrate)
 * Allows this entity to celebrate surviving a raid by making
 * celebration sounds and jumping.
 */
export default interface MinecraftBehaviorCelebrate {

  /**
   * @remarks
   * The sound event to trigger during the celebration.
   * 
   * Sample Values:
   * Evocation Illager: "celebrate"
   *
   *
   */
  celebration_sound?: string;

  /**
   * @remarks
   * The duration in seconds that the celebration lasts for.
   * 
   * Sample Values:
   * Evocation Illager: 30
   *
   *
   */
  duration?: number;

  /**
   * @remarks
   * Minimum and maximum time between jumping (positive, in
   * seconds).
   * 
   * Sample Values:
   * Evocation Illager: {"range_min":1,"range_max":3.5}
   *
   *
   */
  jump_interval?: number[];

  /**
   * @remarks
   * The event to trigger when the goal's duration expires.
   * 
   * Sample Values:
   * Evocation Illager: {"event":"minecraft:stop_celebrating","target":"self"}
   *
   *
   */
  on_celebration_end_event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Evocation Illager: 5
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Minimum and maximum time between sound events (positive, in
   * seconds).
   * 
   * Sample Values:
   * Evocation Illager: {"range_min":2,"range_max":7}
   *
   *
   */
  sound_interval?: number[];

}