// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_riding
 * 
 * minecraft:is_riding Samples
 * At Full..: 
{ "test": "is_riding", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "is_riding" }

Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

 * At /minecraft:entity/component_groups/minecraft:riding/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "is_riding",
  "subject": "self",
  "operator": "==",
  "value": false
}

 * At /minecraft:entity/component_groups/minecraft:not_riding/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "is_riding",
  "subject": "self",
  "operator": "==",
  "value": true
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

 * At /minecraft:entity/component_groups/minecraft:parrot_not_riding_player/minecraft:entity_sensor/subsensors/0/event_filters/all_of/0/: 
{
  "test": "is_riding",
  "subject": "self",
  "operator": "equals",
  "value": true
}

 * At /minecraft:entity/component_groups/minecraft:parrot_riding_player/minecraft:entity_sensor/subsensors/0/event_filters/all_of/0/: 
{
  "test": "is_riding",
  "subject": "self",
  "operator": "equals",
  "value": false
}

 * At /minecraft:entity/components/minecraft:healable/filters/: 
{
  "test": "is_riding",
  "operator": "!=",
  "value": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Riding (is_riding)
 * Returns true if the subject entity is riding on another 
 * entity.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface IsRiding {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Enderman: "=="
   *
   * Parrot: "equals", "!="
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Enderman: "self"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Enderman: "is_riding"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Enderman: true
   *
   *
   */
  value?: boolean;

}


export enum IsRidingOperator {
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


export enum IsRidingSubject {
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