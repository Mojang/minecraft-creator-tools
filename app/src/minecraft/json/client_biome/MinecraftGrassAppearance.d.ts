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
 * Grass Appearance (minecraft:grass_appearance)
 * Set the grass color or color map used during rendering. Biomes
 * without this component will have default grass appearance.
 */
export default interface MinecraftGrassAppearance {

  /**
   * @remarks
   * RGB color of grass.
   */
  color: object;

}