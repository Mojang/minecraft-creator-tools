// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:weather_at_position
 * 
 * minecraft:weather_at_position Samples
 * At Full..: 
{ "test": "weather_at_position", "subject": "self", "operator": "equals", "value": "player" }
 * At Short (using Defaults)..: 
{ "test": "weather_at_position", "value": "player" }

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:fox_thunderstorm/minecraft:environment_sensor/triggers/0/filters/all_of/0/: 
{
  "test": "weather_at_position",
  "operator": "!=",
  "value": "thunderstorm"
}

 * At /minecraft:entity/component_groups/minecraft:fox_day/minecraft:environment_sensor/triggers/0/filters/: 
{
  "test": "weather_at_position",
  "value": "thunderstorm"
}

 * At /minecraft:entity/component_groups/minecraft:fox_day/minecraft:behavior.nap/can_nap_filters/all_of/3/: 
{
  "test": "weather_at_position",
  "subject": "self",
  "operator": "!=",
  "value": "thunderstorm"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Weather At Position (weather_at_position)
 * Tests the current weather, at the actor's position, against a
 * provided weather value.
 */
export default interface WeatherAtPosition {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Fox: "!="
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Fox: "self"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: "weather_at_position"
   *
   */
  test: string;

  /**
   * @remarks
   * (Required) The Family name to look for
   * 
   * Sample Values:
   * Fox: "thunderstorm"
   *
   */
  value: string;

}


export enum WeatherAtPositionOperator {
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


export enum WeatherAtPositionSubject {
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