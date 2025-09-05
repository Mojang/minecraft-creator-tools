// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:attack_damage
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Attack Damage
 * Specifies how much damage is dealt by the entity when it
 * attacks.
 */
export default interface AttackDamage {

  /**
   * @remarks
   * How much an attack should damage a target.
   */
  value?: number[];

}