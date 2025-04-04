// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_underwater
 * 
 * minecraft:is_underwater Samples
 * At Full..: 
{ "test": "is_underwater", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "is_underwater" }

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

 * At /minecraft:entity/component_groups/minecraft:ranged_attack/minecraft:environment_sensor/triggers/0/filters/: 
{
  "test": "is_underwater",
  "subject": "self",
  "operator": "==",
  "value": true
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

 * At /minecraft:entity/component_groups/minecraft:start_zombie_transformation/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "is_underwater",
  "subject": "self",
  "operator": "==",
  "value": false
}


Zombie - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie.json

 * At /minecraft:entity/components/minecraft:environment_sensor/triggers/filters/: 
{
  "test": "is_underwater",
  "operator": "==",
  "value": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Underwater (is_underwater)
 * Returns true when the subject entity is under water. An entity is
 * considered underwater if it is completely submerged in water
 * blocks.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface IsUnderwater {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Bogged: "=="
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Bogged: "self"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bogged: "is_underwater"
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Bogged: true
   *
   */
  value: boolean;

}


export enum IsUnderwaterOperator {
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


export enum IsUnderwaterSubject {
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