// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_difficulty
 * 
 * minecraft:is_difficulty Samples
 * At Full..: 
{ "test": "is_difficulty", "subject": "self", "operator": "equals", "value": "normal" }
 * At Short (using Defaults)..: 
{ "test": "is_difficulty", "value": "normal" }

Arrow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/arrow.json

{
  "test": "is_difficulty",
  "value": "hard"
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/events/attacked/sequence/1/filters/: 
{
  "test": "is_difficulty",
  "value": "easy"
}

 * At /minecraft:entity/events/attacked/sequence/2/filters/: 
{
  "test": "is_difficulty",
  "value": "normal"
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/components/minecraft:damage_sensor/triggers/0/on_damage/filters/1/: 
{
  "test": "is_difficulty",
  "operator": "!=",
  "value": "peaceful"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Difficulty (is_difficulty)
 * Tests the current difficulty level of the game.
 */
export default interface IsDifficulty {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Villager v2: "!="
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
   * Arrow: "is_difficulty"
   *
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) The game's difficulty level to test
   * 
   * Sample Values:
   * Arrow: "hard"
   *
   * Bee: "easy", "normal"
   *
   */
  value?: string;

}


export enum IsDifficultyOperator {
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


export enum IsDifficultySubject {
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


export enum IsDifficultyValue {
  easy = `easy`,
  hard = `hard`,
  normal = `normal`,
  peaceful = `peaceful`
}