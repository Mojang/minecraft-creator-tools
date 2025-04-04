// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:hover_text_color
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Hover Text Color (minecraft:hover_text_color)
 * Determines the color of the item name when hovering over it.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface MinecraftHoverTextColor {

  /**
   * @remarks
   * The color of the item hover text.
   */
  value: string;

}