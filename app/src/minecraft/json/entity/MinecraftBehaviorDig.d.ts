// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dig
 * 
 * minecraft:behavior.dig Samples

Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:behavior.dig": {
  "priority": 1,
  "duration": 5.5,
  "idle_time": 60,
  "vibration_is_disturbance": true,
  "suspicion_is_disturbance": true,
  "digs_in_daylight": false,
  "on_start": {
    "event": "on_digging_event",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dig Behavior (minecraft:behavior.dig)
 * Allows this entity to dig into the ground before despawning.
 */
export default interface MinecraftBehaviorDig {

  /**
   * @remarks
   * If true, this behavior can run when this entity is named. Otherwise
   * not.
   */
  allow_dig_when_named: boolean;

  /**
   * @remarks
   * Indicates that the actor should start digging when it sees
   * daylight
   */
  digs_in_daylight: boolean;

  /**
   * @remarks
   * Goal duration in seconds
   * 
   * Sample Values:
   * Warden: 5.5
   *
   */
  duration: number;

  /**
   * @remarks
   * The minimum idle time in seconds between the last detected
   * disturbance to the start of digging.
   * 
   * Sample Values:
   * Warden: 60
   *
   */
  idle_time: number;

  /**
   * @remarks
   * Event(s) to run when the goal starts.
   * 
   * Sample Values:
   * Warden: {"event":"on_digging_event","target":"self"}
   *
   */
  on_start: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Warden: 1
   *
   */
  priority: number;

  /**
   * @remarks
   * If true, finding new suspicious locations count as disturbances that
   * may delay the start of this goal.
   * 
   * Sample Values:
   * Warden: true
   *
   */
  suspicion_is_disturbance: boolean;

  /**
   * @remarks
   * If true, vibrations count as disturbances that may delay the
   * start of this goal.
   * 
   * Sample Values:
   * Warden: true
   *
   */
  vibration_is_disturbance: boolean;

}