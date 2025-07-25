// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.swell
 * 
 * minecraft:behavior.swell Samples

Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:behavior.swell": {
  "start_distance": 2.5,
  "stop_distance": 6,
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Swell Behavior (minecraft:behavior.swell)
 * Allows the creeper to swell up when a player is nearby. It can
 * only be used by Creepers.
 */
export default interface MinecraftBehaviorSwell {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Creeper: 2
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * This mob starts swelling when a target is at least this many
   * blocks away
   * 
   * Sample Values:
   * Creeper: 2.5
   *
   *
   */
  start_distance: number;

  /**
   * @remarks
   * This mob stops swelling when a target has moved away at least this
   * many blocks
   * 
   * Sample Values:
   * Creeper: 6
   *
   *
   */
  stop_distance: number;

}