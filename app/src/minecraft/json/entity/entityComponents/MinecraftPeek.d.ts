// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:peek
 * 
 * minecraft:peek Samples

Shulker - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/shulker.json

"minecraft:peek": {
  "on_open": {
    "event": "minecraft:on_open"
  },
  "on_close": {
    "event": "minecraft:on_close"
  },
  "on_target_open": {
    "event": "minecraft:on_open"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Peek (minecraft:peek)
 * Defines the entity's 'peek' behavior, defining the events that
 * should be called during it.
 */
export default interface MinecraftPeek {

  /**
   * @remarks
   * Event to call when the entity is done peeking.
   * 
   * Sample Values:
   * Shulker: {"event":"minecraft:on_close"}
   *
   */
  on_close: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to call when the entity starts peeking.
   * 
   * Sample Values:
   * Shulker: {"event":"minecraft:on_open"}
   *
   */
  on_open: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to call when the entity's target entity starts 
   * peeking.
   * 
   * Sample Values:
   * Shulker: {"event":"minecraft:on_open"}
   *
   */
  on_target_open: jsoncommon.MinecraftEventTrigger;

}