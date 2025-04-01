// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_look_around
 * 
 * minecraft:behavior.random_look_around Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.random_look_around": {
  "priority": 8
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:behavior.random_look_around": {
  "priority": 5
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:behavior.random_look_around": {
  "priority": 7
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

"minecraft:behavior.random_look_around": {
  "priority": 9
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:behavior.random_look_around": {
  "priority": 6
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.random_look_around": {
  "priority": 15
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

"minecraft:behavior.random_look_around": {
  "priority": 11
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.random_look_around": {
  "priority": 12
}


Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

"minecraft:behavior.random_look_around": {
  "priority": 10
}


Snow Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snow_golem.json

"minecraft:behavior.random_look_around": {
  "priority": 4
}


Witch - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/witch.json

"minecraft:behavior.random_look_around": {
  "priority": 5,
  "look_distance": 8
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Look Around Behavior 
 * (minecraft:behavior.random_look_around)
 * Allows the mob to randomly look around.
 */
export default interface MinecraftBehaviorRandomLookAround {

  /**
   * @remarks
   * 
   * Sample Values:
   * Witch: 8
   *
   */
  look_distance: number;

  /**
   * @remarks
   * The range of time in seconds the mob will stay looking in a
   * random direction before looking elsewhere
   */
  look_time: number[];

  /**
   * @remarks
   * The rightmost angle a mob can look at on the horizontal plane with
   * respect to its initial facing direction.
   */
  max_angle_of_view_horizontal: number;

  /**
   * @remarks
   * The leftmost angle a mob can look at on the horizontal plane with
   * respect to its initial facing direction.
   */
  min_angle_of_view_horizontal: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 8
   *
   *
   * Blaze: 5
   *
   * Cave Spider: 7
   *
   */
  priority: number;

}