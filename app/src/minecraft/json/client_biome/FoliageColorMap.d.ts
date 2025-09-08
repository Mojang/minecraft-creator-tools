// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:foliage_color_map
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Foliage Color Map (Foliage Color Map)
 * Object specifying a color map for foliage instead of a
 * specific color.
 */
export default interface FoliageColorMap {

  /**
   * @remarks
   * Color map from textures/colormap to determine color of 
   * foliage.
   */
  color_map: string;

}