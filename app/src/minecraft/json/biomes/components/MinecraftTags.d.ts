// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:tags
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Tags (minecraft:tags)
 * Attach arbitrary string tags to this biome.
 */
export default interface MinecraftTags {

  /**
   * @remarks
   * Array of string tags used by other systems such as entity 
   * spawning
   */
  tags: string[];

}