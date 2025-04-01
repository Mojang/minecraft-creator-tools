// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:in_contact_with_water
 * 
 * minecraft:in_contact_with_water Samples
 * At Full..: 
{ "test": "in_contact_with_water", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "in_contact_with_water" }

Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

{
  "test": "in_contact_with_water",
  "operator": "==",
  "value": true
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

{
  "test": "in_contact_with_water"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * In Contact With Water (in_contact_with_water)
 * Returns true when the subject entity in contact with any water:
 * water, rain, splash water bottle.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface InContactWithWater {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Blaze: "=="
   *
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Blaze: "in_contact_with_water"
   *
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Blaze: true
   *
   *
   */
  value: boolean;

}


export enum InContactWithWaterOperator {
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


export enum InContactWithWaterSubject {
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