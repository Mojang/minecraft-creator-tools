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

Skeleton Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/skeleton_horse.json

"minecraft:scale_by_age": {
  "start_scale": 0.5,
  "end_scale": 1
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
   * Skeleton Horse: 1
   *
   */
  end_scale?: number;

  /**
   * @remarks
   * Initial scale of the newborn entity.
   * 
   * Sample Values:
   * Skeleton Horse: 0.5
   *
   */
  start_scale?: number;

}