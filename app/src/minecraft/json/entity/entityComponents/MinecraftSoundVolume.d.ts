// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:sound_volume
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Sound Volume (minecraft:sound_volume)
 * Sets the entity's base volume for sound effects.
 */
export default interface MinecraftSoundVolume {

  /**
   * @remarks
   * The value of the volume the entity uses for sound effects.
   */
  value?: number;

}