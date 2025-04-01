// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:storage_weight_limit
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Storage Weight Limit (minecraft:storage_weight_limit)
 * Specifies the maximum weight limit that a storage item can 
 * hold.
 */
export default interface MinecraftStorageWeightLimit {

  /**
   * @remarks
   * The maximum allowed weight of the sum of all contained items.
   * Maximum is 64. Default is 64.
   */
  max_weight_limit: number;

}