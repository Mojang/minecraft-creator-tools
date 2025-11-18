// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:actor_health
 * 
 * minecraft:actor_health Samples
 * At Full..: 
{ "test": "actor_health", "subject": "self", "operator": "equals", "value": "0" }
 * At Short (using Defaults)..: 
{ "test": "actor_health", "value": "0" }

Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:spawned_by_player/minecraft:environment_sensor/triggers/0/filters/all_of/1/any_of/1/: 
{
  "test": "actor_health",
  "subject": "target",
  "value": 0
}

 * At /minecraft:entity/component_groups/minecraft:neutral/minecraft:looked_at/filters/: 
{
  "test": "actor_health",
  "subject": "other",
  "operator": ">",
  "value": 0
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Actor Health (actor_health)
 * Tests the health of the subject.
 */
export default interface ActorHealth {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Creaking: ">"
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Creaking: "target", "other"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Creaking: "actor_health"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) An integer value.
   */
  value?: number;

}


export enum ActorHealthOperator {
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


export enum ActorHealthSubject {
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