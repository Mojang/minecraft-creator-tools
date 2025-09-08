// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:in_lava
 * 
 * minecraft:in_lava Samples
 * At Full..: 
{ "test": "in_lava", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "in_lava" }

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

{
  "test": "in_lava",
  "subject": "self"
}


Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

{
  "test": "in_lava",
  "subject": "self",
  "operator": "==",
  "value": true
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

 * At /minecraft:entity/components/minecraft:behavior.jump_around_target/filters/all_of/2/: 
{
  "test": "in_lava",
  "value": false
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

{
  "test": "in_lava"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * In Lava (in_lava)
 * Returns true when the subject entity is in lava.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface InLava {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Armor Stand: "=="
   *
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Allay: "self"
   *
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: "in_lava"
   *
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   * 
   * Sample Values:
   * Armor Stand: true
   *
   *
   */
  value?: boolean;

}


export enum InLavaOperator {
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


export enum InLavaSubject {
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