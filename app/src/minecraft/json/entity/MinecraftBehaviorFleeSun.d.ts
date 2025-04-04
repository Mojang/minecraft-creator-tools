// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.flee_sun
 * 
 * minecraft:behavior.flee_sun Samples

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.flee_sun": {
  "priority": 2,
  "speed_multiplier": 1
}


Zombie Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_villager_v2.json

"minecraft:behavior.flee_sun": {
  "priority": 4,
  "speed_multiplier": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Flee Sun Behavior (minecraft:behavior.flee_sun)
 * Allows the mob to run away from direct sunlight and seek 
 * shade.
 */
export default interface MinecraftBehaviorFleeSun {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Bogged: 2
   *
   *
   * Zombie Villager V2: 4
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Bogged: 1
   *
   *
   */
  speed_multiplier: number;

}