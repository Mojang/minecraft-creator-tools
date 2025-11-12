// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.admire_item
 * 
 * minecraft:behavior.admire_item Samples

Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.admire_item": {
  "priority": 2,
  "admire_item_sound": "admire",
  "sound_interval": {
    "range_min": 8,
    "range_max": 8
  },
  "on_admire_item_start": {
    "event": "admire_item_started_event",
    "target": "self"
  },
  "on_admire_item_stop": {
    "event": "admire_item_stopped_event",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Admire Item Behavior (minecraft:behavior.admire_item)
 * Enables the mob to admire items that have been configured as
 * admirable.
 */
export default interface MinecraftBehaviorAdmireItem {

  /**
   * @remarks
   * The sound event to play when admiring the item
   * 
   * Sample Values:
   * Piglin: "admire"
   *
   */
  admire_item_sound?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Piglin: {"event":"admire_item_started_event","target":"self"}
   *
   */
  on_admire_item_start?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * 
   * Sample Values:
   * Piglin: {"event":"admire_item_stopped_event","target":"self"}
   *
   */
  on_admire_item_stop?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Piglin: 2
   *
   */
  priority?: number;

  /**
   * @remarks
   * The range of time in seconds to randomly wait before playing the
   * sound again.
   * 
   * Sample Values:
   * Piglin: {"range_min":8,"range_max":8}
   *
   */
  sound_interval?: number[];

}