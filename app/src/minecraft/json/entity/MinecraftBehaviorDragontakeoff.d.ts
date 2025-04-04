// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragontakeoff
 * 
 * minecraft:behavior.dragontakeoff Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragontakeoff": {
  "priority": 0
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragontakeoff Behavior (minecraft:behavior.dragontakeoff)
 * Allows the dragon to leave perch mode and go back to flying 
 * around.
 */
export default interface MinecraftBehaviorDragontakeoff {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

}