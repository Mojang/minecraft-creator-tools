// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:on_wake_with_owner
 * 
 * minecraft:on_wake_with_owner Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:on_wake_with_owner": {
  "event": "minecraft:pet_slept_with_owner",
  "target": "self"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * On wake with owner trigger (minecraft:on_wake_with_owner)
 * A trigger when a mob's tamed onwer wakes up.
 */
export default interface MinecraftOnWakeWithOwner {

  /**
   * @remarks
   * The event to run when the conditions for this trigger are 
   * met.
   * 
   * Sample Values:
   * Cat: "minecraft:pet_slept_with_owner"
   *
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
   * Cat: "self"
   *
   *
   */
  target: string;

}