// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.glide
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Glide Movement
 * This move control causes the mob to glide.
 */
export default interface GlideMovement {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   */
  max_turn: number;

  /**
   * @remarks
   * Speed that the mob adjusts to when it has to turn quickly.
   */
  speed_when_turning: number;

}