// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_stroll
 * 
 * minecraft:behavior.random_stroll Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.random_stroll": {
  "priority": 6,
  "speed_multiplier": 1
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.random_stroll": {
  "priority": 9,
  "interval": 100
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:behavior.random_stroll": {
  "priority": 4,
  "speed_multiplier": 1
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.random_stroll": {
  "priority": 6,
  "speed_multiplier": 2
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.random_stroll": {
  "priority": 8,
  "speed_multiplier": 0.8
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:behavior.random_stroll": {
  "priority": 6,
  "speed_multiplier": 0.8
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:behavior.random_stroll": {
  "priority": 7,
  "speed_multiplier": 0.3
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:behavior.random_stroll": {
  "priority": 5,
  "speed_multiplier": 1
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:behavior.random_stroll": {
  "priority": 6,
  "speed_multiplier": 0.7
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.random_stroll": {
  "priority": 7,
  "speed_multiplier": 1
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.random_stroll": {
  "priority": 8,
  "speed_multiplier": 0.6
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.random_stroll": {
  "priority": 13,
  "speed_multiplier": 0.8
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Stroll Behavior (minecraft:behavior.random_stroll)
 * Allows a mob to randomly stroll around.
 */
export default interface MinecraftBehaviorRandomStroll {

  /**
   * @remarks
   * A random value to determine when to randomly move somewhere. This
   * has a 1/interval chance to choose this goal
   * 
   * Sample Values:
   * Axolotl: 100
   *
   *
   */
  interval: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Armadillo: 6
   *
   * Axolotl: 9
   *
   * Blaze: 4
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Armadillo: 1
   *
   *
   * Camel: 2
   *
   * Cat: 0.8
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * Distance in blocks on ground that the mob will look for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Iron Golem: 16
   *
   * Rabbit: 2
   *
   */
  xz_dist: number;

  /**
   * @remarks
   * Distance in blocks that the mob will look up or down for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Rabbit: 1
   *
   */
  y_dist: number;

}