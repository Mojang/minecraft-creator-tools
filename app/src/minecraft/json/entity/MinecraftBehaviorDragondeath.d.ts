// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragondeath
 * 
 * minecraft:behavior.dragondeath Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragondeath": {
  "priority": 0
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragondeath Behavior (minecraft:behavior.dragondeath)
 * Allows the dragon to go out with glory. This controls the Ender
 * Dragon's death animation.
 */
export default interface MinecraftBehaviorDragondeath {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

}