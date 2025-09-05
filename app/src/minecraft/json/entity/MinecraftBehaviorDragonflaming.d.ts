// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragonflaming
 * 
 * minecraft:behavior.dragonflaming Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragonflaming": {
  "priority": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragonflaming Behavior (minecraft:behavior.dragonflaming)
 * Allows this entity to use a flame-breath attack.
 */
export default interface MinecraftBehaviorDragonflaming {

  /**
   * @remarks
   * Time (in seconds) between each start of the cycle to roar, then
   * breath flame.
   */
  cooldown_time?: number;

  /**
   * @remarks
   * Time (in seconds), after roar, to breath flame.
   */
  flame_time?: number;

  /**
   * @remarks
   * Number of ground flame-breath attacks to use before 
   * flight-takeoff.
   */
  ground_flame_count?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ender Dragon: 1
   *
   */
  priority?: number;

  /**
   * @remarks
   * Time (in seconds) to roar, before breathing flame.
   */
  roar_time?: number;

}