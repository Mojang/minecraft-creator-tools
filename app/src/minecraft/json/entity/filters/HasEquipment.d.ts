// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:has_equipment
 * 
 * minecraft:has_equipment Samples
 * At Full..: 
{ "test": "has_equipment", "subject": "self", "domain": "any", "operator": "equals", "value": "dirt" }
 * At Short (using Defaults)..: 
{ "test": "has_equipment", "value": "dirt" }

Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

{
  "test": "has_equipment",
  "domain": "head",
  "subject": "other",
  "operator": "not",
  "value": "carved_pumpkin"
}


Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

{
  "test": "has_equipment",
  "subject": "other",
  "domain": "hand",
  "value": "saddle"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Has Equipment (has_equipment)
 * Tests for the presence of a named item in the designated slot of
 * the subject entity.
 */
export default interface HasEquipment {

  /**
   * @remarks
   * (Optional) The equipment location to test
   * 
   * Sample Values:
   * Enderman: "head"
   *
   * Pig: "hand"
   *
   *
   */
  domain: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Enderman: "not"
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Enderman: "other"
   *
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Enderman: "has_equipment"
   *
   *
   */
  test: string;

  /**
   * @remarks
   * (Required) The item name to look for
   * 
   * Sample Values:
   * Enderman: "carved_pumpkin"
   *
   * Pig: "saddle"
   *
   *
   */
  value: string;

}


export enum HasEquipmentDomain {
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


export enum HasEquipmentOperator {
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


export enum HasEquipmentSubject {
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