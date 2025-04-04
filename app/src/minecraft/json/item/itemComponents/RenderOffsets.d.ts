// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:render_offsets
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Render Offsets
 * Render offsets component: optional values can be given to
 * offset the way the item is rendered.
 * IMPORTANT
 * This type is now deprecated, and no longer in use in the latest versions of Minecraft.
 * 
 */
export default interface RenderOffsets {

  /**
   * @remarks
   * Main hand transform data.
   */
  main_hand: object;

  /**
   * @remarks
   * Offhand hand transform data.
   */
  off_hand: object;

}