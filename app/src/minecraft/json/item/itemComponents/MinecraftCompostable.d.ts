// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:compostable
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Compostable (minecraft:compostable)
 * Specifies that an item is compostable and provides the chance of
 * creating a composting layer in the composter.
 */
export default interface MinecraftCompostable {

  /**
   * @remarks
   * The chance of this item to create a layer upon composting with
   * the composter. Valid value range is 1 - 100 inclusive
   */
  composting_chance: number;

}