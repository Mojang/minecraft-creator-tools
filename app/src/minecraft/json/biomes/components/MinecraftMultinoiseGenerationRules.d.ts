// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:multinoise_generation_rules
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Multinoise Generation Rules Biome
 * (minecraft:multinoise_generation_rules)
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the nether.
 */
export default interface MinecraftMultinoiseGenerationRules {

  /**
   * @remarks
   * Altitude with which this biome should be generated, relative to
   * other biomes.
   */
  target_altitude: number;

  /**
   * @remarks
   * Humidity with which this biome should be generated, relative to
   * other biomes.
   */
  target_humidity: number;

  /**
   * @remarks
   * Temperature with which this biome should be generated, relative to
   * other biomes.
   */
  target_temperature: number;

  /**
   * @remarks
   * Weirdness with which this biome should be generated, relative to
   * other biomes.
   */
  target_weirdness: number;

  /**
   * @remarks
   * Weight with which this biome should be generated, relative to
   * other biomes.
   */
  weight: number;

}