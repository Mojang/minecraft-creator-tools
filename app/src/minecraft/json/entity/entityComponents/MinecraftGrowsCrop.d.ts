// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:grows_crop
 * 
 * minecraft:grows_crop Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:grows_crop": {
  "charges": 10,
  "chance": 0.03
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Grows Crop (minecraft:grows_crop)
 * Could increase crop growth when entity walks over crop.
 */
export default interface MinecraftGrowsCrop {

  /**
   * @remarks
   * Value between 0-1. Chance of success per tick.
   * 
   * Sample Values:
   * Bee: 0.03
   *
   */
  chance?: number;

  /**
   * @remarks
   * Number of charges
   * 
   * Sample Values:
   * Bee: 10
   *
   */
  charges?: number;

}