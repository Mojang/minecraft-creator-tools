// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:overworld_generation_rules
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Overworld Generation Rules Biome
 * (minecraft:overworld_generation_rules)
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the overworld.
 */
export default interface MinecraftOverworldGenerationRules {

  /**
   * @remarks
   * Can be just the name of a biome, or an array of any size. If an
   * array, each entry can be a biome name string, or an array of
   * size 2, where the first entry is a biome name and the second entry
   * is a positive integer representing how that biome is weighted against
   * other entries. If no weight is provided, a weight of 1 is 
   * used.
   */
  generate_for_climates: object[];

  /**
   * @remarks
   * An array of any size containing arrays of exactly two elements. For
   * each contained array, the first element is a climate category string
   * ('medium', 'warm', 'lukewarm', 'cold', or 'frozen'). The second
   * element is a positive integer for how much that entry is
   * weighted relative to other entries.
   */
  hills_transformation: string[];

  /**
   * @remarks
   * What biome to switch to when converting to a mutated biome
   */
  mutate_transformation: string[];

  /**
   * @remarks
   * What biome to switch to when converting to a river biome (if not
   * the Vanilla 'river' biome)
   */
  river_transformation: string[];

  /**
   * @remarks
   * What biome to switch to when adjacent to an ocean biome
   */
  shore_transformation: string[];

}