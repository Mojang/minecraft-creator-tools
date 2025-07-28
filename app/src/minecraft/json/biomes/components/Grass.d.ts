// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:grass
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Grass Biome (grass)
 * Sets the color grass will be tinted by in this biome on the 
 * map.
 */
export default interface Grass {

  /**
   * @remarks
   * Tint color used in this biome on the map.
   */
  tint: string;

  /**
   * @remarks
   * Controls the type of grass tint to use.
   */
  type: string;

}