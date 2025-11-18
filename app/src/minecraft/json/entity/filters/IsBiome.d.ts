// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_biome
 * 
 * minecraft:is_biome Samples
 * At Full..: 
{ "test": "is_biome", "subject": "self", "operator": "equals", "value": "beach" }
 * At Short (using Defaults)..: 
{ "test": "is_biome", "value": "beach" }

Fishing Hook - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fishing_hook.json

{
  "test": "is_biome",
  "value": "jungle"
}


Rabbit - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/rabbit.json

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/2/filters/: 
{
  "test": "is_biome",
  "value": "desert"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Biome (is_biome)
 * Tests whether the Subject is currently in the named biome.
 */
export default interface IsBiome {

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
   * 
   * Sample Values:
   * Fishing Hook: "is_biome"
   *
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) The Biome type to test
   * 
   * Sample Values:
   * Fishing Hook: "jungle"
   *
   * Rabbit: "desert"
   *
   */
  value?: string;

}


export enum IsBiomeOperator {
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


export enum IsBiomeSubject {
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


export enum IsBiomeValue {
  beach = `beach`,
  desert = `desert`,
  extremeHills = `extreme_hills`,
  flat = `flat`,
  forest = `forest`,
  ice = `ice`,
  jungle = `jungle`,
  mesa = `mesa`,
  mushroomIsland = `mushroom_island`,
  ocean = `ocean`,
  plain = `plain`,
  river = `river`,
  savanna = `savanna`,
  stoneBeach = `stone_beach`,
  swamp = `swamp`,
  taiga = `taiga`,
  theEnd = `the_end`,
  theNether = `the_nether`
}