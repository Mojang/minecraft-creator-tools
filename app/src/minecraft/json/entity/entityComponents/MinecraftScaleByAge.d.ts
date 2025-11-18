// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:scale_by_age
 * 
 * minecraft:scale_by_age Samples

Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:scale_by_age": {
  "start_scale": 0.5,
  "end_scale": 1
}


Zombie Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_horse.json

"minecraft:scale_by_age": {
  "start_scale": 0.5,
  "end_scale": 0.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Scale By Age (minecraft:scale_by_age)
 * Defines the entity's size interpolation based on the entity's 
 * age.
 */
export default interface MinecraftScaleByAge {

  /**
   * @remarks
   * Ending scale of the entity when it's fully grown.
   * 
   * Sample Values:
   * Donkey: 1
   *
   *
   * Zombie Horse: 0.5
   *
   */
  end_scale?: number;

  /**
   * @remarks
   * Initial scale of the newborn entity.
   * 
   * Sample Values:
   * Donkey: 0.5
   *
   *
   */
  start_scale?: number;

}