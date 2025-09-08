// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.beg
 * 
 * minecraft:behavior.beg Samples

Wolf - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wolf.json

"minecraft:behavior.beg": {
  "priority": 9,
  "look_distance": 8,
  "look_time": [
    2,
    4
  ],
  "items": [
    "bone",
    "porkchop",
    "cooked_porkchop",
    "chicken",
    "cooked_chicken",
    "beef",
    "cooked_beef",
    "rotten_flesh",
    "muttonraw",
    "muttoncooked",
    "rabbit",
    "cooked_rabbit"
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Beg Behavior (minecraft:behavior.beg)
 * Allows this mob to look at and follow the player that holds food
 * they like.
 */
export default interface MinecraftBehaviorBeg {

  /**
   * @remarks
   * List of items that this mob likes
   * 
   * Sample Values:
   * Wolf: ["bone","porkchop","cooked_porkchop","chicken","cooked_chicken","beef","cooked_beef","rotten_flesh","muttonraw","muttoncooked","rabbit","cooked_rabbit"]
   *
   */
  items?: string[];

  /**
   * @remarks
   * Distance in blocks the mob will beg from
   * 
   * Sample Values:
   * Wolf: 8
   *
   */
  look_distance?: number;

  /**
   * @remarks
   * The range of time in seconds this mob will stare at the player
   * holding a food they like, begging for it
   * 
   * Sample Values:
   * Wolf: [2,4]
   *
   */
  look_time?: number[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Wolf: 9
   *
   */
  priority?: number;

}