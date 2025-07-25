// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:storage_weight_limit
 * 
 * minecraft:storage_weight_limit Samples

Black Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/black_bundle.json

"minecraft:storage_weight_limit": {
  "max_weight_limit": 64
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Storage Weight Limit Item
 * (minecraft:storage_weight_limit)
 * Specifies the maximum weight limit that a storage item can 
 * hold.
 */
export default interface MinecraftStorageWeightLimit {

  /**
   * @remarks
   * The maximum allowed weight of the sum of all contained items.
   * Maximum is 64. Default is 64.
   * 
   * Sample Values:
   * Black Bundle: 64
   *
   *
   */
  max_weight_limit: number;

}