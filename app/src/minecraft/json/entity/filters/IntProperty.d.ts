// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:int_property
 * 
 * minecraft:int_property Samples
 * At Full..: 
{ "test": "int_property", "subject": "self", "domain": "minecraft:can_climb", "operator": "equals", "value": "0" }
 * At Short (using Defaults)..: 
{ "test": "int_property", "domain": "minecraft:can_climb", "value": "0" }

Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:environment_sensor/triggers/3/filters/all_of/0/: 
{
  "test": "int_property",
  "domain": "minecraft:creaking_swaying_ticks",
  "operator": ">",
  "value": 0
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:environment_sensor/triggers/3/filters/all_of/1/: 
{
  "test": "int_property",
  "domain": "minecraft:creaking_swaying_ticks",
  "operator": "<=",
  "value": 5
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:environment_sensor/triggers/4/filters/: 
{
  "test": "int_property",
  "domain": "minecraft:creaking_swaying_ticks",
  "operator": ">",
  "value": 5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Int Property (int_property)
 * Returns true when the int actor property matches the value
 * provided.
 */
export default interface IntProperty {

  /**
   * @remarks
   * (Required) The property name to look for
   * 
   * Sample Values:
   * Creaking: "minecraft:creaking_swaying_ticks"
   *
   */
  domain?: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Creaking: ">", "<="
   *
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
   * Creaking: "int_property"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) An integer value.
   * 
   * Sample Values:
   * Creaking: 5
   *
   */
  value?: number;

}


export enum IntPropertyOperator {
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


export enum IntPropertySubject {
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