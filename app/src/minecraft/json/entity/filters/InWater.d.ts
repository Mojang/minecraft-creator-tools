// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:in_water
 * 
 * minecraft:in_water Samples
 * At Full..: 
{ "test": "in_water", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "in_water" }

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

 * At /minecraft:entity/component_groups/axolotl_in_water/minecraft:environment_sensor/triggers/0/filters/: 
{
  "test": "in_water",
  "operator": "!=",
  "value": true
}

 * At /minecraft:entity/component_groups/axolotl_on_land_in_rain/minecraft:environment_sensor/triggers/1/filters/: 
{
  "test": "in_water",
  "operator": "==",
  "value": true
}

 * At /minecraft:entity/components/minecraft:behavior.nearest_attackable_target/entity_types/0/filters/all_of/0/: 
{
  "test": "in_water",
  "subject": "other",
  "value": true
}


Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

{
  "test": "in_water",
  "subject": "self",
  "operator": "==",
  "value": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * In Water (in_water)
 * Returns true when the subject entity is in water.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface InWater {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Axolotl: "!=", "=="
   *
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Axolotl: "other"
   *
   * Pillager: "self"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Axolotl: "in_water"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Axolotl: true
   *
   */
  value?: boolean;

}


export enum InWaterOperator {
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


export enum InWaterSubject {
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