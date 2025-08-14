// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:climate
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Climate Biome (minecraft:climate)
 * Describes temperature, humidity, precipitation, and similar. Biomes
 * without this component will have default values.
 */
export default interface MinecraftClimate {

  /**
   * @remarks
   * Density of ash precipitation visuals
   */
  ash: number;

  /**
   * @remarks
   * Density of blue spore precipitation visuals
   */
  blue_spores: number;

  /**
   * @remarks
   * Amount that precipitation affects colors and block changes
   */
  downfall: number;

  /**
   * @remarks
   * Density of red spore precipitation visuals
   */
  red_spores: number;

  /**
   * @remarks
   * Minimum and maximum snow level, each multiple of 0.125 is
   * another snow layer
   */
  snow_accumulation: number[];

  /**
   * @remarks
   * Temperature affects a variety of visual and behavioral things,
   * including snow and ice placement, sponge drying, and sky 
   * color
   */
  temperature: number;

  /**
   * @remarks
   * Density of white ash precipitation visuals
   */
  white_ash: number;

}