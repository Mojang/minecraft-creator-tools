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


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

 * At /minecraft:entity/components/minecraft:behavior.take_flower/filters/all_of/1/: 
{
  "test": "bool_property",
  "domain": "minecraft:has_flower",
  "value": false
}

 * At /minecraft:entity/components/minecraft:interact/interactions/0/on_interact/filters/all_of/0/: 
{
  "test": "bool_property",
  "domain": "minecraft:is_waxed",
  "value": false
}

 * At /minecraft:entity/components/minecraft:interact/interactions/2/on_interact/filters/all_of/0/: 
{
  "test": "bool_property",
  "domain": "minecraft:is_waxed",
  "value": true
}

 * At /minecraft:entity/components/minecraft:interact/interactions/4/on_interact/filters/all_of/0/: 
{
  "test": "bool_property",
  "domain": "minecraft:has_flower",
  "value": true
}

 * At /minecraft:entity/component_groups/minecraft:becoming_statue/minecraft:behavior.place_block/can_place/: 
{
  "test": "bool_property",
  "domain": "minecraft:is_becoming_statue",
  "value": false
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/events/minecraft:become_immobile/filters/: 
{
  "test": "bool_property",
  "domain": "minecraft:can_move",
  "value": true
}

 * At /minecraft:entity/events/minecraft:become_mobile/filters/: 
{
  "test": "bool_property",
  "domain": "minecraft:can_move",
  "value": false
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
   * Copper Golem: "minecraft:has_flower", "minecraft:is_waxed", "minecraft:is_becoming_statue"
   *
   */
  domain?: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Bee: "!="
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
   * Bee: "bool_property"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Copper Golem: true
   *
   */
  value?: boolean;

}


export enum BoolPropertyOperator {
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


export enum BoolPropertySubject {
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