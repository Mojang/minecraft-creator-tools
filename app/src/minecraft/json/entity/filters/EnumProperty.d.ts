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


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:spawned_by_player/minecraft:environment_sensor/triggers/0/filters/all_of/0/any_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "value": "hostile_observed"
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_player/minecraft:environment_sensor/triggers/0/filters/all_of/0/any_of/1/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "value": "hostile_unobserved"
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:environment_sensor/triggers/1/filters/all_of/0/none_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "value": "twitching"
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:environment_sensor/triggers/2/filters/all_of/0/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "operator": "not",
  "value": "twitching"
}

 * At /minecraft:entity/component_groups/minecraft:spawned_by_creaking_heart/minecraft:environment_sensor/triggers/2/filters/all_of/1/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "operator": "not",
  "value": "crumbling"
}

 * At /minecraft:entity/events/minecraft:become_hostile/filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "value": "neutral"
}

 * At /minecraft:entity/events/minecraft:become_neutral/filters/: 
{
  "test": "enum_property",
  "domain": "minecraft:creaking_state",
  "operator": "not",
  "value": "neutral"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Property (enum_property)
 * Returns true when the enum actor property matches the value
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
   * Creaking: "minecraft:creaking_state"
   *
   * Egg: "minecraft:climate_variant"
   *
   */
  domain: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Armadillo: "not"
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Egg: "other"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: "enum_property"
   *
   */
  test: string;

  /**
   * @remarks
   * (Required) A string value.
   * 
   * Sample Values:
   * Armadillo: "unrolled", "rolled_up", "rolled_up_peeking", "rolled_up_relaxing", "rolled_up_unrolling"
   *
   */
  value: string;

}


export enum EnumPropertyOperator {
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


export enum EnumPropertySubject {
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