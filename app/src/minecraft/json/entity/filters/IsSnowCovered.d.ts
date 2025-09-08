// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_snow_covered
 * 
 * minecraft:is_snow_covered Samples
 * At Full..: 
{ "test": "is_snow_covered", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "is_snow_covered" }

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/1/filters/: 
{
  "test": "is_snow_covered",
  "value": true
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/2/filters/: 
{
  "test": "is_snow_covered",
  "value": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Snow Covered (is_snow_covered)
 * Tests whether the Subject is in an area with snow cover.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface IsSnowCovered {

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
   * 
   * Sample Values:
   * Fox: "is_snow_covered"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Fox: true
   *
   *
   */
  value?: boolean;

}


export enum IsSnowCoveredOperator {
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


export enum IsSnowCoveredSubject {
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