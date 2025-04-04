// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:in_block
 * 
 * minecraft:in_block Samples
 * At Full..: 
{ "test": "in_block", "subject": "self", "operator": "equals", "value": "" }
 * At Short (using Defaults)..: 
{ "test": "in_block" }

Skeleton - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/skeleton.json

 * At /minecraft:entity/component_groups/in_powder_snow/minecraft:environment_sensor/triggers/0/filters/: 
{
  "test": "in_block",
  "subject": "self",
  "operator": "!=",
  "value": "minecraft:powder_snow"
}

 * At /minecraft:entity/component_groups/minecraft:ranged_attack/minecraft:environment_sensor/triggers/2/filters/: 
{
  "test": "in_block",
  "subject": "self",
  "operator": "==",
  "value": "minecraft:powder_snow"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * In Block (in_block)
 * Returns true when the subject entity is inside a specified Block
 * type.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface InBlock {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Skeleton: "!=", "=="
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Skeleton: "self"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Skeleton: "in_block"
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) A string value.
   * 
   * Sample Values:
   * Skeleton: "minecraft:powder_snow"
   *
   */
  value: string;

}


export enum InBlockOperator {
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


export enum InBlockSubject {
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