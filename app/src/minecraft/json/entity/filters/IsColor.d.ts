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
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   */
  subject?: string;

  /**
   * @remarks
   * (Required) The Palette Color to test
   */
  value?: string;

}


export enum IsColorOperator {
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


export enum IsColorSubject {
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


export enum IsColorValue {
  black = `black`,
  blue = `blue`,
  brown = `brown`,
  cyan = `cyan`,
  gray = `gray`,
  green = `green`,
  lightBlue = `light_blue`,
  lightGreen = `light_green`,
  magenta = `magenta`,
  orange = `orange`,
  pink = `pink`,
  purple = `purple`,
  red = `red`,
  silver = `silver`,
  white = `white`,
  yellow = `yellow`
}