// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.follow_parent
 * 
 * minecraft:behavior.follow_parent Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.follow_parent": {
  "priority": 5,
  "speed_multiplier": 1.25
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.follow_parent": {
  "priority": 5,
  "speed_multiplier": 1.1
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.follow_parent": {
  "priority": 11,
  "speed_multiplier": 1.1
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.follow_parent": {
  "priority": 5,
  "speed_multiplier": 2.5
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.follow_parent": {
  "priority": 4,
  "speed_multiplier": 1.1
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:behavior.follow_parent": {
  "priority": 4,
  "speed_multiplier": 1
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.follow_parent": {
  "priority": 9,
  "speed_multiplier": 1.1
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:behavior.follow_parent": {
  "priority": 6,
  "speed_multiplier": 1
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:behavior.follow_parent": {
  "priority": 5,
  "speed_multiplier": 1
}


Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:behavior.follow_parent": {
  "priority": 13,
  "speed_multiplier": 1.1
}


Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

"minecraft:behavior.follow_parent": {
  "priority": 6,
  "speed_multiplier": 1.1
}


Polar Bear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/polar_bear.json

"minecraft:behavior.follow_parent": {
  "priority": 4,
  "speed_multiplier": 1.25
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Follow Parent Behavior (minecraft:behavior.follow_parent)
 * Allows the mob to follow their parent around.
 */
export default interface MinecraftBehaviorFollowParent {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Armadillo: 5
   *
   *
   * Bee: 11
   *
   * Dolphin: 4
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Armadillo: 1.25
   *
   * Axolotl: 1.1
   *
   *
   * Camel: 2.5
   *
   */
  speed_multiplier: number;

}