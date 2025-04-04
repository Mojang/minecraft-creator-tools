// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:biome_description
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Description Biome
 * Contains non-component settings for a Biome.
 */
export default interface BiomeDescriptionBiome {

  /**
   * @remarks
   * The name of the Biome, used by other features like the '/locate
   * biome' command.
   */
  identifier: string;

}