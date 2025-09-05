// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragonlanding
 * 
 * minecraft:behavior.dragonlanding Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragonlanding": {
  "priority": 0
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragonlanding Behavior (minecraft:behavior.dragonlanding)
 * Allows the Dragon to stop flying and transition into perching 
 * mode.
 */
export default interface MinecraftBehaviorDragonlanding {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

}