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

 * At /minecraft:entity/component_groups/minecraft:pig_unsaddled/minecraft:interact/interactions/0/on_interact/filters/: 
{
  "test": "has_equipment",
  "subject": "other",
  "domain": "hand",
  "value": "saddle"
}

 * At /minecraft:entity/component_groups/minecraft:pig_saddled/minecraft:interact/interactions/0/on_interact/filters/all_of/1/: 
{
  "test": "has_equipment",
  "subject": "other",
  "domain": "hand",
  "value": "shears"
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
   */
  domain?: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Enderman: "not"
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Enderman: "other"
   *
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Enderman: "has_equipment"
   *
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) The item name to look for
   * 
   * Sample Values:
   * Enderman: "carved_pumpkin"
   *
   * Pig: "saddle", "shears"
   *
   */
  value?: string;

}


export enum HasEquipmentDomain {
  any = `any`,
  armor = `armor`,
  body = `body`,
  feet = `feet`,
  hand = `hand`,
  head = `head`,
  inventory = `inventory`,
  leg = `leg`,
  mainHand = `main_hand`,
  torso = `torso`
}


export enum HasEquipmentOperator {
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


export enum HasEquipmentSubject {
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