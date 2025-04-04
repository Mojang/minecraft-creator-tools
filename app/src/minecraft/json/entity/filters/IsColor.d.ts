// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_color
 * 
 * minecraft:is_color Samples
 * At Full..: 
{ "test": "is_color", "subject": "self", "operator": "equals", "value": "white" }
 * At Short (using Defaults)..: 
{ "test": "is_color", "value": "white" }
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Color (is_color)
 * Returns true if the subject entity is the named color.
 */
export default interface IsColor {

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
   * (Required) The Palette Color to test
   */
  value: string;

}


export enum IsColorOperator {
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


export enum IsColorSubject {
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


export enum IsColorValue {
  Black = `black`,
  Blue = `blue`,
  Brown = `brown`,
  Cyan = `cyan`,
  Gray = `gray`,
  Green = `green`,
  LightBlue = `light_blue`,
  LightGreen = `light_green`,
  Magenta = `magenta`,
  Orange = `orange`,
  Pink = `pink`,
  Purple = `purple`,
  Red = `red`,
  Silver = `silver`,
  White = `white`,
  Yellow = `yellow`
}