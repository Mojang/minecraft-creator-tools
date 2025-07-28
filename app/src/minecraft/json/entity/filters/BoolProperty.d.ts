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


Wolf - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wolf.json

 * At /minecraft:entity/components/minecraft:environment_sensor/triggers/0/filters/all_of/0/: 
{
  "test": "bool_property",
  "operator": "!=",
  "domain": "minecraft:has_increased_max_health"
}

 * At /minecraft:entity/components/minecraft:environment_sensor/triggers/1/filters/all_of/0/: 
{
  "test": "bool_property",
  "operator": "!=",
  "domain": "minecraft:is_armorable"
}

 * At /minecraft:entity/components/minecraft:environment_sensor/triggers/2/filters/: 
{
  "test": "bool_property",
  "operator": "!=",
  "domain": "minecraft:was_upgraded_to_1_21_100"
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
   * Happy Ghast: "minecraft:can_move"
   *
   * Wolf: "minecraft:has_increased_max_health", "minecraft:is_armorable", "minecraft:was_upgraded_to_1_21_100"
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
   * 
   * Sample Values:
   * Happy Ghast: true
   *
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