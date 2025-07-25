// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:biome_replacement
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Replacement Biome (Biome Replacement)
 * Represents the replacement information used to determine the
 * placement of the overriding biome.
 */
export default interface BiomeReplacement {

  /**
   * @remarks
   * Noise value used to determine whether or not the replacement is
   * attempted, similar to a percentage. Must be in the range (0.0,
   * 1.0].
   */
  amount: number;

  /**
   * @remarks
   * Dimension in which this replacement can happen. Must be
   * 'minecraft:overworld'.
   */
  dimension: string;

  /**
   * @remarks
   * Scaling value used to alter the frequency of replacement attempts. A
   * lower frequency will mean a bigger contiguous biome area that
   * occurs less often. A higher frequency will mean smaller contiguous
   * biome areas that occur more often. Must be in the range (0.0,
   * 100.0].
   */
  noise_frequency_scale: number;

  /**
   * @remarks
   * Biomes that are going to be replaced by the overriding biome.
   * Target biomes must not contain namespaces.
   */
  targets: object[];

}