// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:precipitation
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Precipitation (minecraft:precipitation)
 * Describes the visuals for a biome's precipitation. Biomes without
 * this component will have default values. At most one
 * precipitation type can be set for a biome.
 */
export default interface MinecraftPrecipitation {

  /**
   * @remarks
   * Density of ash precipitation visuals
   */
  ash?: number;

  /**
   * @remarks
   * Density of blue spore precipitation visuals
   */
  blue_spores?: number;

  /**
   * @remarks
   * Density of red spore precipitation visuals
   */
  red_spores?: number;

  /**
   * @remarks
   * Density of white ash precipitation visuals
   */
  white_ash?: number;

}