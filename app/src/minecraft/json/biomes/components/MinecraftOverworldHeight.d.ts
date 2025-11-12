// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:overworld_height
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Overworld Height (minecraft:overworld_height)
 * Noise parameters used to drive terrain height in the 
 * Overworld.
 * Note: This is a pre-Caves and Cliffs component. It does not
 * change overworld height, and currently only affects map item
 * rendering.
 */
export default interface MinecraftOverworldHeight {

  /**
   * @remarks
   * First value is depth - more negative means deeper underwater, while
   * more positive means higher. Second value is scale, which affects how
   * much noise changes as it moves from the surface.
   */
  noise_params?: number[];

  /**
   * @remarks
   * Specifies a preset based on a built-in setting rather than
   * manually using noise_params
   */
  noise_type?: string;

}


export enum MinecraftOverworldHeightNoiseType {
  beach = `beach`,
  deepOcean = `deep_ocean`,
  default = `default`,
  defaultMutated = `default_mutated`,
  extreme = `extreme`,
  highlands = `highlands`,
  lessExtreme = `less_extreme`,
  lowlands = `lowlands`,
  mountains = `mountains`,
  mushroom = `mushroom`,
  ocean = `ocean`,
  river = `river`,
  stoneBeach = `stone_beach`,
  swamp = `swamp`,
  taiga = `taiga`
}