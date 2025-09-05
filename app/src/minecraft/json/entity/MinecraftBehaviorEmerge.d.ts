// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.emerge
 * 
 * minecraft:behavior.emerge Samples

Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:behavior.emerge": {
  "duration": 7,
  "on_done": {
    "event": "minecraft:emerged",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Emerge Behavior (minecraft:behavior.emerge)
 * Allows this entity to emerge from the ground.
 */
export default interface MinecraftBehaviorEmerge {

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   */
  cooldown_time?: number;

  /**
   * @remarks
   * Goal duration in seconds
   * 
   * Sample Values:
   * Warden: 7
   *
   */
  duration?: number;

  /**
   * @remarks
   * Trigger to be executed when the goal execution is about to 
   * end
   * 
   * Sample Values:
   * Warden: {"event":"minecraft:emerged","target":"self"}
   *
   */
  on_done?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

}