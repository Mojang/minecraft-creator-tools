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
 * Biome Climate (minecraft:climate)
 * Describes temperature, humidity, precipitation, and similar. Biomes
 * without this component will have default values.
 */
export default interface MinecraftClimate {

  /**
   * @remarks
   * Amount that precipitation affects colors and block changes. Setting
   * to 0 will stop rain from falling in the biome.
   */
  downfall?: number;

  /**
   * @remarks
   * Minimum and maximum snow level, each multiple of 0.125 is
   * another snow layer
   */
  snow_accumulation?: number[];

  /**
   * @remarks
   * Temperature affects a variety of visual and behavioral things,
   * including snow and ice placement, sponge drying, and sky 
   * color
   */
  temperature?: number;

}