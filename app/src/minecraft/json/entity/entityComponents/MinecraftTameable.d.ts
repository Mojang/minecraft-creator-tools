// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:tameable
 * 
 * minecraft:tameable Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:tameable": {
  "probability": 0.33,
  "tame_items": [
    "fish",
    "salmon"
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:tameable": {
  "probability": 0.33,
  "tame_items": [
    "wheat_seeds",
    "pumpkin_seeds",
    "melon_seeds",
    "beetroot_seeds",
    "pitcher_pod",
    "torchflower_seeds"
  ],
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}


Wolf - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wolf.json

"minecraft:tameable": {
  "probability": 0.33,
  "tame_items": "bone",
  "tame_event": {
    "event": "minecraft:on_tame",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Tameable (minecraft:tameable)
 * This entity can be tamed.
 */
export default interface MinecraftTameable {

  /**
   * @remarks
   * The chance of taming the entity with each item use between 0.0
   * and 1.0, where 1.0 is 100%
   * 
   * Sample Values:
   * Cat: 0.33
   *
   *
   */
  probability: number;

  /**
   * @remarks
   * Event to run when this entity becomes tamed
   * 
   * Sample Values:
   * Cat: {"event":"minecraft:on_tame","target":"self"}
   *
   *
   */
  tame_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The list of items that can be used to tame this entity
   * 
   * Sample Values:
   * Cat: ["fish","salmon"]
   *
   * Parrot: ["wheat_seeds","pumpkin_seeds","melon_seeds","beetroot_seeds","pitcher_pod","torchflower_seeds"]
   *
   * Wolf: "bone"
   *
   */
  tame_items: string[];

  tameItems: string;

}