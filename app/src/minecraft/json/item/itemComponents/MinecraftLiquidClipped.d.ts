// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:liquid_clipped
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Liquid Clipped (minecraft:liquid_clipped)
 * The liquid_clipped component determines whether the item
 * interacts with liquid blocks on use.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftLiquidClipped {

  /**
   * @remarks
   * Deterines whether the item interacts with liquid blocks on 
   * use.
   */
  value: boolean;

}