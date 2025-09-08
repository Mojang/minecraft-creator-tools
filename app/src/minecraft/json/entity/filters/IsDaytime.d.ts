// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_daytime
 * 
 * minecraft:is_daytime Samples
 * At Full..: 
{ "test": "is_daytime", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "is_daytime" }

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:defending_fox/minecraft:environment_sensor/triggers/0/filters/all_of/0/: 
{
  "test": "is_daytime",
  "value": true
}

 * At /minecraft:entity/component_groups/minecraft:defending_fox/minecraft:environment_sensor/triggers/1/filters/all_of/0/: 
{
  "test": "is_daytime",
  "value": false
}


Iron Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/iron_golem.json

{
  "test": "is_daytime"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Daytime (is_daytime)
 * Returns true during the daylight hours.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface IsDaytime {

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
   * Fox: "is_daytime"
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
   */
  value?: boolean;

}


export enum IsDaytimeOperator {
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


export enum IsDaytimeSubject {
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