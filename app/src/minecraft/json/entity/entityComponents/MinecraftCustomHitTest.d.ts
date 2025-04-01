// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:custom_hit_test
 * 
 * minecraft:custom_hit_test Samples

Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

 * At /minecraft:entity/component_groups/minecraft:hoglin_baby/minecraft:custom_hit_test/: 
"minecraft:custom_hit_test": {
  "hitboxes": [
    {
      "width": 1,
      "height": 0.85,
      "pivot": [
        0,
        0.5,
        0
      ]
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:hoglin_adult/minecraft:custom_hit_test/: 
"minecraft:custom_hit_test": {
  "hitboxes": [
    {
      "width": 2,
      "height": 1.75,
      "pivot": [
        0,
        1,
        0
      ]
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Custom Hit Test (minecraft:custom_hit_test)
 * List of hitboxes for melee and ranged hits against the 
 * entity.
 */
export default interface MinecraftCustomHitTest {

  /**
   * @remarks
   * Comma seperated list of hitboxes.
   * 
   * Sample Values:
   * Hoglin: [{"width":1,"height":0.85,"pivot":[0,0.5,0]}], [{"width":2,"height":1.75,"pivot":[0,1,0]}]
   *
   *
   */
  hitboxes: string[];

}