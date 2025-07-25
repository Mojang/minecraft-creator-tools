// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:grass_appearance
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Grass Appearance Client Biome
 * (minecraft:grass_appearance)
 * Set the grass color or color map used during rendering. Biomes
 * without this component will have default grass appearance.
 */
export default interface MinecraftGrassAppearance {

  /**
   * @remarks
   * RGB color of grass.
   */
  color: object;

  /**
   * @remarks
   * Adds a shading effect to the grass as if there was a roof.
   */
  grass_is_shaded: boolean;

}