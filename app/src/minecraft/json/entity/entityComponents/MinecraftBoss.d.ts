// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:boss
 * 
 * minecraft:boss Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Boss (minecraft:boss)
 * Defines the current state of the boss for updating the boss 
 * HUD.
 */
export default interface MinecraftBoss {

  /**
   * @remarks
   * The max distance from the boss at which the boss's health bar is
   * present on the players screen.
   */
  hud_range?: number;

  /**
   * @remarks
   * The name that will be displayed above the boss's health bar.
   */
  name?: string;

  /**
   * @remarks
   * Whether the sky should darken in the presence of the boss.
   */
  should_darken_sky?: boolean;

}