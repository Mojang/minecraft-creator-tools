// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.sound_distance_offset
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Movement Sound Distance Offset
 * (minecraft:movement_sound_distance_offset)
 * Sets the offset used to determine the next step distance for
 * playing a movement sound.
 */
export default interface MinecraftMovementSoundDistanceOffset {

  /**
   * @remarks
   * The higher the number, the less often the movement sound will be
   * played.
   */
  value?: number;

}