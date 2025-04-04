// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:on_start_takeoff
 * 
 * minecraft:on_start_takeoff Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:on_start_takeoff": {
  "event": "minecraft:start_fly",
  "target": "self"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * On Start Takeoff (minecraft:on_start_takeoff)
 * Only usable by the Ender Dragon. Adds a trigger to call when this
 * entity starts flying.
 */
export default interface MinecraftOnStartTakeoff {

  /**
   * @remarks
   * The event to run when the conditions for this trigger are 
   * met.
   * 
   * Sample Values:
   * Ender Dragon: "minecraft:start_fly"
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