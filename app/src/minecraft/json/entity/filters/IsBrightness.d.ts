// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_brightness
 * 
 * minecraft:is_brightness Samples
 * At Full..: 
{ "test": "is_brightness", "subject": "self", "operator": "equals", "value": "0.50" }
 * At Short (using Defaults)..: 
{ "test": "is_brightness", "value": "0.50" }

Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_neutral/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "is_brightness",
  "operator": "<",
  "value": 0.49
}

 * At /minecraft:entity/component_groups/minecraft:spider_hostile/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "is_brightness",
  "operator": ">",
  "value": 0.49
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Brightness (is_brightness)
 * Tests the current brightness against a provided value in the
 * range (0.0f, 1.0f).
 */
export default interface IsBrightness {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Cave Spider: "<", ">"
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
   * Cave Spider: "is_brightness"
   *
   */
  test: string;

  /**
   * @remarks
   * (Required) The brightness value to compare with.
   * 
   * Sample Values:
   * Cave Spider: 0.49
   *
   */
  value: number;

}


export enum IsBrightnessOperator {
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


export enum IsBrightnessSubject {
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