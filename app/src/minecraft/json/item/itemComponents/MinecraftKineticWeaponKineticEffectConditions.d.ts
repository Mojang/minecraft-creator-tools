// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:kinetic_weapon_kinetic_effect_conditions
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Kinetic Weapon Kinetic Effect Conditions (minecraft:kinetic_weapon
 * kinetic_effect_conditions)
 * Conditions that need to be satisfied for a specific effect of a
 * kinetic weapon to be applied.
 */
export default interface MinecraftKineticWeaponKineticEffectConditions {

  /**
   * @remarks
   * Time, in ticks, during which the effect can be applied after
   * "delay" elapses. If negative, the effect is applied 
   * indefinitely.
   */
  max_duration?: number;

  /**
   * @remarks
   * Minimum relative speed of the user with respect to the target
   * (projected onto the view vector via a dot product) required for
   * the effect to be applied.
   */
  min_relative_speed?: number;

  /**
   * @remarks
   * Minimum user's speed (projected onto the view vector via a dot
   * product) required for the effect to be applied.
   */
  min_speed?: number;

}