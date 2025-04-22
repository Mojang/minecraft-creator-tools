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
 * Minecraft Overworld Height Biome 
 * (minecraft:overworld_height)
 * Noise parameters used to drive terrain height in the 
 * Overworld.
 */
export default interface MinecraftOverworldHeight {

  /**
   * @remarks
   * First value is depth - more negative means deeper underwater, while
   * more positive means higher. Second value is scale, which affects how
   * much noise changes as it moves from the surface.
   */
  noise_params: number[];

  /**
   * @remarks
   * Specifies a preset based on a built-in setting rather than
   * manually using noise_params
   */
  noise_type: string;

}