// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:custom_map_tint_grass_tint
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Custom Map Tint Grass Tint 
 * (custom_map_tint_grass_tint)
 * Sets the color grass will be tinted by in this biome on the 
 * map.
 */
export default interface CustomMapTintGrassTint {

  /**
   * @remarks
   * Tint color used in this biome on the map.
   */
  tint: string;

  /**
   * @remarks
   * Controls the type of grass tint to use.
   */
  type: string;

}


export enum CustomMapTintGrassTintType {
  noise = `noise`,
  tint = `tint`
}