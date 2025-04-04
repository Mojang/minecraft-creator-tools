// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:has_damaged_equipment
 * 
 * minecraft:has_damaged_equipment Samples
 * At Full..: 
{ "test": "has_damaged_equipment", "subject": "self", "domain": "any", "operator": "equals", "value": "dirt" }
 * At Short (using Defaults)..: 
{ "test": "has_damaged_equipment", "value": "dirt" }
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Has Damaged Equipment (has_damaged_equipment)
 * Tests for the presence of a damaged named item in the designated slot
 * of the subject entity.
 */
export default interface HasDamagedEquipment {

  /**
   * @remarks
   * (Optional) The equipment location to test
   */
  domain: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   */
  subject: string;

  /**
   * @remarks
   * (Required) The item name to look for
   */
  value: string;

}


export enum HasDamagedEquipmentDomain {
  Any = `any`,
  Armor = `armor`,
  Body = `body`,
  Feet = `feet`,
  Hand = `hand`,
  Head = `head`,
  Inventory = `inventory`,
  Leg = `leg`,
  Torso = `torso`
}


export enum HasDamagedEquipmentOperator {
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


export enum HasDamagedEquipmentSubject {
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