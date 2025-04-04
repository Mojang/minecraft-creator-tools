// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:on_start_landing
 * 
 * minecraft:on_start_landing Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:on_start_landing": {
  "event": "minecraft:start_land",
  "target": "self"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * On Start Landing (minecraft:on_start_landing)
 * Only usable by the Ender Dragon. Adds a trigger to call when this
 * entity lands.
 */
export default interface MinecraftOnStartLanding {

  /**
   * @remarks
   * The event to run when the conditions for this trigger are 
   * met.
   * 
   * Sample Values:
   * Ender Dragon: "minecraft:start_land"
   *
   */
  event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The list of conditions for this trigger to execute.
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The target of the event.
   * 
   * Sample Values:
   * Ender Dragon: "self"
   *
   */
  target: string;

}