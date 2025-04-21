// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:biome_music
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Biome Music Client Biome (minecraft:biome_music)
 * Affects how music plays within the biome.
 */
export default interface MinecraftBiomeMusic {

  /**
   * @remarks
   * Music to be played when inside this biome. If left off or not
   * found the default music will be determined by the dimension. Empty
   * string will result in no music.
   */
  music_definition: string;

  /**
   * @remarks
   * Multiplier temporarily and gradually applied to music volume when
   * within this biome. Must be a value between 0 and 1, 
   * inclusive.
   */
  volume_multiplier: number;

}