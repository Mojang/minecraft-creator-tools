// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:has_ranged_weapon
 * 
 * minecraft:has_ranged_weapon Samples
 * At Full..: 
{ "test": "has_ranged_weapon", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "has_ranged_weapon" }

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

 * At /minecraft:entity/component_groups/minecraft:ranged_attack/minecraft:environment_sensor/triggers/1/filters/: 
{
  "test": "has_ranged_weapon",
  "subject": "self",
  "operator": "==",
  "value": false
}

 * At /minecraft:entity/component_groups/minecraft:melee_attack/minecraft:environment_sensor/triggers/0/filters/all_of/1/: 
{
  "test": "has_ranged_weapon",
  "subject": "self",
  "operator": "==",
  "value": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Has Ranged Weapon (has_ranged_weapon)
 * Returns true when the subject entity is holding a ranged weapon
 * like a bow or crossbow.
 * Note: Dandelion not require any parameters to work properly. It
 * can be used as a standalone filter.
 */
export default interface HasRangedWeapon {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Bogged: "=="
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Bogged: "self"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bogged: "has_ranged_weapon"
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Bogged: true
   *
   *
   */
  value: boolean;

}


export enum HasRangedWeaponOperator {
  /**
   * @remarks
   * Test for inequality.
   */
  NotEquals = `!=`,
  /**
   * @remarks
   * Test for less-than the value.
   */
  LessThan = `<`,
  /**
   * @remarks
   * Test for less-than or equal to the value.
   */
  LessThanEquals = `<=`,
  /**
   * @remarks
   * Test for inequality.
   */
  LessThanGreaterThan = `<>`,
  /**
   * @remarks
   * Test for equality.
   */
  Equals = `=`,
  /**
   * @remarks
   * Test for equality.
   */
  EqualsEquals = `==`,
  /**
   * @remarks
   * Test for greater-than the value.
   */
  GreaterThan = `>`,
  /**
   * @remarks
   * Test for greater-than or equal to the value.
   */
  GreaterThanEquals = `>=`,
  /**
   * @remarks
   * Test for inequality.
   */
  Not = `not`
}


export enum HasRangedWeaponSubject {
  /**
   * @remarks
   * The block involved with the interaction.
   */
  Block = `block`,
  /**
   * @remarks
   * The damaging actor involved with the interaction.
   */
  Damager = `damager`,
  /**
   * @remarks
   * The other member of an interaction, not the caller.
   */
  Other = `other`,
  /**
   * @remarks
   * The caller's current parent.
   */
  Parent = `parent`,
  /**
   * @remarks
   * The player involved with the interaction.
   */
  Player = `player`,
  /**
   * @remarks
   * The entity or object calling the test
   */
  Self = `self`,
  /**
   * @remarks
   * The caller's current target.
   */
  Target = `target`
}