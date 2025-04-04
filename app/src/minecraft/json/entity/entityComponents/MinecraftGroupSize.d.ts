// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:group_size
 * 
 * minecraft:group_size Samples

Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:group_size": {
  "radius": 32,
  "filters": {
    "all_of": [
      {
        "test": "has_component",
        "operator": "!=",
        "value": "minecraft:is_baby"
      },
      {
        "test": "is_family",
        "value": "hoglin"
      }
    ]
  }
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:group_size": {
  "radius": 32,
  "filters": {
    "all_of": [
      {
        "test": "has_component",
        "operator": "!=",
        "value": "minecraft:is_baby"
      },
      {
        "test": "is_family",
        "value": "piglin"
      }
    ]
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Group Size (minecraft:group_size)
 * Keeps track of entity group size in the given radius.
 */
export default interface MinecraftGroupSize {

  /**
   * @remarks
   * The list of conditions that must be satisfied for other entities to
   * be counted towards group size.
   * 
   * Sample Values:
   * Hoglin: {"all_of":[{"test":"has_component","operator":"!=","value":"minecraft:is_baby"},{"test":"is_family","value":"hoglin"}]}
   *
   * Piglin: {"all_of":[{"test":"has_component","operator":"!=","value":"minecraft:is_baby"},{"test":"is_family","value":"piglin"}]}
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Radius from center of entity.
   * 
   * Sample Values:
   * Hoglin: 32
   *
   *
   */
  radius: number;

}