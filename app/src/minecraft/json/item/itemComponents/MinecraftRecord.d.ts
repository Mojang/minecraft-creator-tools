// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:record
 * 
 * minecraft:record Samples
"minecraft:record": {
  "comparator_signal": 1,
  "duration": 5,
  "sound_event": "ambient.tame"
}


My Sword Singing - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_singing.json

"minecraft:record": {
  "comparator_signal": 1,
  "duration": 5,
  "sound_event": "pre_ram.screamer"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Record (minecraft:record)
 * Used by record items to play music.
 */
export default interface MinecraftRecord {

  /**
   * @remarks
   * Specifies signal strength for comparator blocks to use, from 1
   * - 13.
   * 
   * Sample Values:
   * My Sword Singing: 1
   *
   */
  comparator_signal: number;

  /**
   * @remarks
   * Specifies duration of sound event in seconds, float value.
   * 
   * Sample Values:
   * My Sword Singing: 5
   *
   */
  duration: number;

  /**
   * @remarks
   * Sound event type: 13, cat, blocks, chirp, far, mall, mellohi, stal,
   * strad, ward, 11, wait, pigstep, otherside, 5, relic.
   * 
   * Sample Values:
   * My Sword Singing: "pre_ram.screamer"
   *
   */
  sound_event: string;

}