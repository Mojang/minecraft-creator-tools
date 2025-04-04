// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:client_biome_description
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Description Client Biome
 * Contains non-component settings for a Client Biome.
 */
export default interface ClientBiomeDescriptionClientBiome {

  /**
   * @remarks
   * The name of the Client Biome, used by other features like the
   * '/locate biome' command. Must match the name of a Biome defined by
   * the game or a behavior pack.
   */
  identifier: string;

}