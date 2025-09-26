// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:color
 * 
 * minecraft:color Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Color (minecraft:color)
 * Defines the entity's main color.
 * Note: This attribute only works on vanilla entities that have
 * predefined color values (sheep, llama, shulker).
 */
export default interface MinecraftColor {

  /**
   * @remarks
   * The Palette Color value of the entity.
   */
  value?: number;

}