// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragonscanning
 * 
 * minecraft:behavior.dragonscanning Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragonscanning": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragonscanning Behavior (minecraft:behavior.dragonscanning)
 * Allows the dragon to look around for a player to attack while in
 * perch mode.
 */
export default interface MinecraftBehaviorDragonscanning {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ender Dragon: 2
   *
   */
  priority?: number;

}