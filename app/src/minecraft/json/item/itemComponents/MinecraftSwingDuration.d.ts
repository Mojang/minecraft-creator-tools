// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:swing_duration
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Swing Duration (minecraft:swing_duration)
 * Duration, in seconds, of the item's swing animation played when
 * mining or attacking. Affects visuals only and does not impact
 * attack frequency or other gameplay mechanics.
 */
export default interface MinecraftSwingDuration {

  /**
   * @remarks
   * Duration, in seconds, of the item's swing animation played when
   * mining or attacking. Affects visuals only and does not impact
   * attack frequency or other gameplay mechanics. Default value: 
   * 0.3.
   */
  value?: number;

}