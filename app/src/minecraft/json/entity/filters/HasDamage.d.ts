// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:has_damage
 * 
 * minecraft:has_damage Samples
 * At Full..: 
{ "test": "has_damage", "subject": "self", "operator": "equals", "value": "fatal" }
 * At Short (using Defaults)..: 
{ "test": "has_damage", "value": "fatal" }
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Has Damage (has_damage)
 * Returns true when the subject entity receives the named damage
 * type.
 */
export default interface HasDamage {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   */
  subject?: string;

  /**
   * @remarks
   * (Required) The Damage type to test
   */
  value?: string;

}


export enum HasDamageOperator {
  /**
   * @remarks
   * Test for inequality.
   */
  notEquals = `!=`,
  /**
   * @remarks
   * Test for less-than the value.
   */
  lessThan = `<`,
  /**
   * @remarks
   * Test for less-than or equal to the value.
   */
  lessThanEquals = `<=`,
  /**
   * @remarks
   * Test for inequality.
   */
  lessThanGreaterThan = `<>`,
  /**
   * @remarks
   * Test for equality.
   */
  equals = `=`,
  /**
   * @remarks
   * Test for equality.
   */
  equalsEquals = `==`,
  /**
   * @remarks
   * Test for greater-than the value.
   */
  greaterThan = `>`,
  /**
   * @remarks
   * Test for greater-than or equal to the value.
   */
  greaterThanEquals = `>=`,
  /**
   * @remarks
   * Test for inequality.
   */
  not = `not`
}


export enum HasDamageSubject {
  /**
   * @remarks
   * The block involved with the interaction.
   */
  block = `block`,
  /**
   * @remarks
   * The damaging actor involved with the interaction.
   */
  damager = `damager`,
  /**
   * @remarks
   * The other member of an interaction, not the caller.
   */
  other = `other`,
  /**
   * @remarks
   * The caller's current parent.
   */
  parent = `parent`,
  /**
   * @remarks
   * The player involved with the interaction.
   */
  player = `player`,
  /**
   * @remarks
   * The entity or object calling the test
   */
  self = `self`,
  /**
   * @remarks
   * The caller's current target.
   */
  target = `target`
}


export enum HasDamageValue {
  anvil = `anvil`,
  attack = `attack`,
  blockExplosion = `block_explosion`,
  contact = `contact`,
  drowning = `drowning`,
  entityExplosion = `entity_explosion`,
  fall = `fall`,
  fallingBlock = `falling_block`,
  /**
   * @remarks
   * Any damage which kills the subject
   */
  fatal = `fatal`,
  fire = `fire`,
  fireTick = `fire_tick`,
  flyIntoWall = `fly_into_wall`,
  lava = `lava`,
  magic = `magic`,
  none = `none`,
  override = `override`,
  piston = `piston`,
  projectile = `projectile`,
  selfDestruct = `self_destruct`,
  sonicBoom = `sonic_boom`,
  stalactite = `stalactite`,
  stalagmite = `stalagmite`,
  starve = `starve`,
  suffocation = `suffocation`,
  thorns = `thorns`,
  void = `void`,
  wither = `wither`
}