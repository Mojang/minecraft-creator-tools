// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.look_at_player
 * 
 * minecraft:behavior.look_at_player Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.look_at_player": {
  "priority": 8,
  "target_distance": 6,
  "probability": 0.02
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:behavior.look_at_player": {
  "priority": 7,
  "target_distance": 6,
  "probability": 0.02,
  "min_look_time": 40,
  "max_look_time": 80
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.look_at_player": {
  "priority": 10,
  "target_distance": 6,
  "probability": 0.02
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.look_at_player": {
  "priority": 7,
  "look_distance": 8
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:behavior.look_at_player": {
  "priority": 7,
  "look_distance": 16
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:behavior.look_at_player": {
  "priority": 7,
  "target_distance": 6,
  "probability": 0.02
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.look_at_player": {
  "priority": 9
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:behavior.look_at_player": {
  "priority": 7,
  "look_distance": 6,
  "probability": 0.02
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:behavior.look_at_player": {
  "priority": 6,
  "look_distance": 6,
  "probability": 0.02
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:behavior.look_at_player": {
  "priority": 6,
  "look_distance": 8
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.look_at_player": {
  "priority": 8,
  "look_distance": 6
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.look_at_player": {
  "priority": 8,
  "look_distance": 6,
  "probability": 0.02
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Look At Player Behavior (minecraft:behavior.look_at_player)
 * Compels an entity to look at the player by rotating the `head` bone
 * pose within a set limit.
 */
export default interface MinecraftBehaviorLookAtPlayer {

  /**
   * @remarks
   * The angle in degrees that the mob can see in the Y-axis 
   * (up-down).
   * 
   * Sample Values:
   * Ravager: 45
   *
   */
  angle_of_view_horizontal?: number;

  /**
   * @remarks
   * The angle in degrees that the mob can see in the X-axis
   * (left-right).
   */
  angle_of_view_vertical?: number;

  /**
   * @remarks
   * The distance in blocks from which the entity will look at the
   * nearest player.
   * 
   * Sample Values:
   * Bogged: 8
   *
   * Breeze: 16
   *
   * Cave Spider: 6
   *
   */
  look_distance?: number;

  /**
   * @remarks
   * Time range to look at the nearest player.
   * 
   * Sample Values:
   * Zombie Horse: [2,4]
   *
   * Campghost: [0,100]
   *
   */
  look_time?: number[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: 80
   *
   */
  max_look_time?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: 40
   *
   */
  min_look_time?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 8
   *
   * Armadillo: 7
   *
   * Axolotl: 10
   *
   */
  priority?: number;

  /**
   * @remarks
   * The probability of looking at the target. A value of 1.00 is
   * 100%.
   * 
   * Sample Values:
   * Allay: 0.02
   *
   *
   * Elder Guardian: 0.01
   *
   * Enderman: 8
   *
   */
  probability?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: 6
   *
   *
   */
  target_distance?: number;

}