// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:enum_property
 * 
 * minecraft:enum_property Samples
 * At Full..: 
{ "test": "enum_property", "subject": "self", "domain": "minecraft:can_climb", "operator": "equals", "value": "" }
 * At Short (using Defaults)..: 
{ "test": "enum_property", "domain": "minecraft:can_climb", "value": "" }

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

 * At /minecraft:entity/component_groups/minecraft:baby/minecraft:ageable/interact_filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "value": "unrolled"
}

 * At /minecraft:entity/events/minecraft:no_threat_detected/sequence/0/filters/all_of/0/any_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "value": "rolled_up"
}

 * At /minecraft:entity/events/minecraft:no_threat_detected/sequence/0/filters/all_of/0/any_of/1/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "value": "rolled_up_peeking"
}

 * At /minecraft:entity/events/minecraft:threat_detected/sequence/1/filters/any_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "value": "rolled_up_relaxing"
}

 * At /minecraft:entity/events/minecraft:threat_detected/sequence/1/filters/any_of/1/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "value": "rolled_up_unrolling"
}

 * At /minecraft:entity/events/minecraft:unroll/sequence/0/filters/all_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "operator": "not",
  "value": "unrolled"
}

 * At /minecraft:entity/events/minecraft:roll_up/sequence/0/filters/all_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "operator": "not",
  "value": "rolled_up"
}

 * At /minecraft:entity/events/minecraft:roll_up/sequence/0/filters/all_of/1/: 
{
  "test": "enum_property",
  "domain": "minecraft:armadillo_state",
  "operator": "not",
  "value": "rolled_up_peeking"
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

 * At /minecraft:entity/components/minecraft:interact/interactions/1/on_interact/filters/all_of/1/: 
{
  "test": "enum_property",
  "domain": "minecraft:oxidation_level",
  "operator": "not",
  "value": "unoxidized"
}

 * At /minecraft:entity/events/minecraft:wax_off/sequence/0/first_valid/0/filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:oxidation_level",
  "value": "oxidized"
}

 * At /minecraft:entity/events/minecraft:oxidize_copper/first_valid/0/filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:oxidation_level",
  "value": "unoxidized"
}

 * At /minecraft:entity/events/minecraft:oxidize_copper/first_valid/1/filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:oxidation_level",
  "value": "exposed"
}

 * At /minecraft:entity/events/minecraft:oxidize_copper/first_valid/2/filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:oxidation_level",
  "value": "weathered"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Property (enum_property)
 * Returns true when the actor property matches the value 
 * provided.
 */
export default interface EnumProperty {

  /**
   * @remarks
   * (Required) The property name to look for
   * 
   * Sample Values:
   * Armadillo: "minecraft:armadillo_state"
   *
   * Copper Golem: "minecraft:oxidation_level"
   *
   * Creaking: "minecraft:creaking_state"
   *
   */
  domain?: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Armadillo: "not"
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Egg: "other"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: "enum_property"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) A string value.
   * 
   * Sample Values:
   * Armadillo: "unrolled", "rolled_up", "rolled_up_peeking", "rolled_up_relaxing", "rolled_up_unrolling"
   *
   */
  value?: string;

}


export enum EnumPropertyOperator {
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


export enum EnumPropertySubject {
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