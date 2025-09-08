// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.breed
 * 
 * minecraft:behavior.breed Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.breed": {
  "priority": 2,
  "speed_multiplier": 1
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.breed": {
  "priority": 1,
  "speed_multiplier": 1
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.breed": {
  "priority": 4,
  "speed_multiplier": 1
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.breed": {
  "priority": 3,
  "speed_multiplier": 1
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.breed": {
  "priority": 4
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:behavior.breed": {
  "priority": 3,
  "speed_multiplier": 0.6
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Breed Behavior (minecraft:behavior.breed)
 * Allows this mob to breed with other mobs.
 */
export default interface MinecraftBehaviorBreed {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Armadillo: 2
   *
   * Axolotl: 1
   *
   * Bee: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Armadillo: 1
   *
   *
   * Goat: 0.6
   *
   *
   */
  speed_multiplier?: number;

}