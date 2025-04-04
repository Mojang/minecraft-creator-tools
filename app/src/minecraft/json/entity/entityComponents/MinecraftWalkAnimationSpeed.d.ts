// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:walk_animation_speed
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Walk Animation Speed (minecraft:walk_animation_speed)
 * Sets the speed multiplier for this entity's walk animation 
 * speed.
 */
export default interface MinecraftWalkAnimationSpeed {

  /**
   * @remarks
   * The higher the number, the faster the animation for walking plays.
   * A value of 1.0 means normal speed, while 2.0 means twice as
   * fast.
   */
  value: number;

}