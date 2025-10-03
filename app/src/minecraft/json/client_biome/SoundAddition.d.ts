// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:sound_addition
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Sound Addition (Sound Addition)
 */
export default interface SoundAddition {

  /**
   * @remarks
   * Name of the sound asset to play
   */
  asset: object;

  /**
   * @remarks
   * Probability of the sound playing each interval, between 0.0 and
   * 1.0
   */
  chance: number;

}