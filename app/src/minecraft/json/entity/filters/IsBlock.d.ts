// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_block
 * 
 * minecraft:is_block Samples
 * At Full..: 
{ "test": "is_block", "subject": "self", "operator": "equals", "value": "player" }
 * At Short (using Defaults)..: 
{ "test": "is_block", "value": "player" }

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/return_to_home/minecraft:behavior.go_home/on_home/0/filters/any_of/0/: 
{
  "test": "is_block",
  "subject": "block",
  "value": "minecraft:bee_nest"
}

 * At /minecraft:entity/component_groups/return_to_home/minecraft:behavior.go_home/on_home/0/filters/any_of/1/: 
{
  "test": "is_block",
  "subject": "block",
  "value": "minecraft:beehive"
}

 * At /minecraft:entity/component_groups/return_to_home/minecraft:behavior.go_home/on_home/1/filters/all_of/0/: 
{
  "test": "is_block",
  "subject": "block",
  "operator": "!=",
  "value": "minecraft:bee_nest"
}

 * At /minecraft:entity/component_groups/return_to_home/minecraft:behavior.go_home/on_home/1/filters/all_of/1/: 
{
  "test": "is_block",
  "subject": "block",
  "operator": "!=",
  "value": "minecraft:beehive"
}

 * At /minecraft:entity/components/minecraft:damage_sensor/triggers/1/on_damage/filters/: 
{
  "test": "is_block",
  "subject": "block",
  "value": "minecraft:sweet_berry_bush"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Block (is_block)
 * Returns true when the block has the given name.
 */
export default interface IsBlock {

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
   * 
   * Sample Values:
   * Bee: "block"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: "is_block"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) The Family name to look for
   * 
   * Sample Values:
   * Bee: "minecraft:bee_nest", "minecraft:beehive", "minecraft:sweet_berry_bush"
   *
   */
  value?: string;

}


export enum IsBlockOperator {
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


export enum IsBlockSubject {
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