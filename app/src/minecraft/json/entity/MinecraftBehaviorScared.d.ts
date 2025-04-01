// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.scared
 * 
 * minecraft:behavior.scared Samples

Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:behavior.scared": {
  "priority": 1,
  "sound_interval": 20
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Scared Behavior (minecraft:behavior.scared)
 * Allows the a mob to become scared when the weather outside is
 * thundering.
 */
export default interface MinecraftBehaviorScared {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Panda: 1
   *
   */
  priority: number;

  /**
   * @remarks
   * The interval in which a sound will play when active in a
   * 1/delay chance to kick off
   * 
   * Sample Values:
   * Panda: 20
   *
   */
  sound_interval: number;

}