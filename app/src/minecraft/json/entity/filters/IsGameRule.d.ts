// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_game_rule
 * 
 * minecraft:is_game_rule Samples
 * At Full..: 
{ "test": "is_game_rule", "subject": "self", "domain": "domobspawning", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "is_game_rule", "domain": "domobspawning" }

Ender Pearl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_pearl.json

{
  "test": "is_game_rule",
  "domain": "domobspawning",
  "value": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Game Rule (is_game_rule)
 * Tests whether a named game rule is active.
 */
export default interface IsGameRule {

  /**
   * @remarks
   * (Required) The Game Rule to test.
   * 
   * Sample Values:
   * Ender Pearl: "domobspawning"
   *
   */
  domain: string;

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
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
   * Ender Pearl: "is_game_rule"
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) true or false.
   */
  value: boolean;

}


export enum IsGameRuleOperator {
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


export enum IsGameRuleSubject {
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