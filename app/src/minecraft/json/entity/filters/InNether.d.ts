// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:in_nether
 * 
 * minecraft:in_nether Samples
 * At Full..: 
{ "test": "in_nether", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "in_nether" }

Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

 * At /minecraft:entity/component_groups/zombification_sensor/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "in_nether",
  "subject": "self",
  "operator": "==",
  "value": false
}

 * At /minecraft:entity/component_groups/start_zombification/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "in_nether",
  "subject": "self",
  "operator": "==",
  "value": true
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

 * At /minecraft:entity/component_groups/zombification_sensor/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "in_nether",
  "value": false
}

 * At /minecraft:entity/component_groups/start_zombification/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "in_nether"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * In Nether (in_nether)
 * Returns true when the subject entity is in Nether.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface InNether {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Hoglin: "=="
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Hoglin: "self"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Hoglin: "in_nether"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Hoglin: true
   *
   *
   */
  value?: boolean;

}


export enum InNetherOperator {
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


export enum InNetherSubject {
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