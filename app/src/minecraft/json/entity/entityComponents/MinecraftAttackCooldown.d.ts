// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:attack_cooldown
 * 
 * minecraft:attack_cooldown Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Attack Cooldown (minecraft:attack_cooldown)
 * Adds a cooldown to an entity. The intention of this cooldown is
 * to be used to prevent the entity from attempting to acquire new
 * attack targets.
 */
export default interface MinecraftAttackCooldown {

  /**
   * @remarks
   * Event to be run when the cooldown is complete.
   */
  attack_cooldown_complete_event: string;

  /**
   * @remarks
   * Amount of time in seconds for the cooldown. Can be specified as
   * a number or a pair of numbers (min and max).
   */
  attack_cooldown_time: number[];

}