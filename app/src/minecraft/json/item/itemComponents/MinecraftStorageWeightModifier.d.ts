// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:storage_weight_modifier
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Storage Weight Modifier (minecraft:storage_weight_modifier)
 * Specifies the maximum weight limit that a storage item can 
 * hold.
 */
export default interface MinecraftStorageWeightModifier {

  /**
   * @remarks
   * The weight of this item when inside another Storage Item. Default is
   * 4. 0 means item is not allowed in another Storage Item.
   */
  weight_in_storage_item: number;

}