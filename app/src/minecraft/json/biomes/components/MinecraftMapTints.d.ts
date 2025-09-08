// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:map_tints
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Map Tints (minecraft:map_tints)
 * Sets the color grass and foliage will be tinted by in this biome
 * on the map.
 */
export default interface MinecraftMapTints {

  /**
   * @remarks
   * Sets the color foliage will be tinted by in this biome on the
   * map.
   */
  foliage?: string;

  /**
   * @remarks
   * Controls whether the grass will use a custom tint color or a
   * noise based tint color.
   */
  grass: object;

}