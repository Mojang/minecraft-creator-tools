// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:loot
 * 
 * minecraft:loot Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Loot (minecraft:loot)
 * Sets the loot table for what items this entity drops upon 
 * death.
 * Note: Requires a loot table to be used when dropping items upon
 * death.
 */
export default interface MinecraftLoot {

  /**
   * @remarks
   * The path to the loot table, relative to the Behavior Pack's 
   * root.
   */
  table?: string;

}