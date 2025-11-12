// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:grass_color_map
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Grass Color Map (Grass Color Map)
 * Object specifying a color map for grass instead of a specific 
 * color.
 */
export default interface GrassColorMap {

  /**
   * @remarks
   * Color map from textures/colormap to determine color of 
   * grass.
   */
  color_map: string;

}


export enum GrassColorMapColorMap {
  grass = `grass`,
  swampGrass = `swamp_grass`
}