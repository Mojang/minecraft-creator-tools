// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.jump
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Jump Movement (minecraft:movement.jump)
 * Move control that causes the mob to jump as it moves with a
 * specified delay between jumps.
 * Note: In order to follow targets, this entity must have the
 * `minecraft:behavior.slime_attack` component, otherwise the
 * entity will jump in the direction it's looking in.
 */
export default interface MinecraftMovementJump {

  /**
   * @remarks
   * Delay after landing when using the slime move control.
   */
  jump_delay: number[];

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   */
  max_turn: number;

}