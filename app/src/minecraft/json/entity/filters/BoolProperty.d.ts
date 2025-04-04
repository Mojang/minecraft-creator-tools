// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:bool_property
 * 
 * minecraft:bool_property Samples
 * At Full..: 
{ "test": "bool_property", "subject": "self", "domain": "minecraft:can_climb", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "bool_property", "domain": "minecraft:can_climb" }

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/shelter_detection/minecraft:environment_sensor/triggers/0/filters/all_of/1/: 
{
  "test": "bool_property",
  "domain": "minecraft:has_nectar",
  "operator": "!="
}

 * At /minecraft:entity/events/find_hive_timeout/sequence/0/filters/: 
{
  "test": "bool_property",
  "operator": "!=",
  "domain": "minecraft:has_nectar"
}

 * At /minecraft:entity/events/find_hive_timeout/sequence/1/filters/: 
{
  "test": "bool_property",
  "domain": "minecraft:has_nectar"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Bool Property (bool_property)
 * Returns true when the bool actor property matches the value
 * provided.
 */
export default interface BoolProperty {

  /**
   * @remarks
   * (Required) The property name to look for
   * 
   * Sample Values:
   * Bee: "minecraft:has_nectar"
   *
   */
  domain: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Bee: "!="
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
   * Bee: "bool_property"
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) true or false.
   */
  value: boolean;

}


export enum BoolPropertyOperator {
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


export enum BoolPropertySubject {
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