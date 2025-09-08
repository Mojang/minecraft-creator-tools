// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:custom_map_tint_grass_noise
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Custom Map Tint Grass Noise 
 * (custom_map_tint_grass_noise)
 * Makes grass use the noise based colors for tinting in this biome
 * on the map.
 */
export default interface CustomMapTintGrassNoise {

  /**
   * @remarks
   * Controls the type of grass tint to use.
   */
  type: string;

}