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
   * Fishing Hook: "is_biome"
   *
   *
   */
  test: string;

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
  value: string;

}


export enum IsBiomeOperator {
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


export enum IsBiomeSubject {
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


export enum IsBiomeValue {
  Beach = `beach`,
  Desert = `desert`,
  ExtremeHills = `extreme_hills`,
  Flat = `flat`,
  Forest = `forest`,
  Ice = `ice`,
  Jungle = `jungle`,
  Mesa = `mesa`,
  MushroomIsland = `mushroom_island`,
  Ocean = `ocean`,
  Plain = `plain`,
  River = `river`,
  Savanna = `savanna`,
  StoneBeach = `stone_beach`,
  Swamp = `swamp`,
  Taiga = `taiga`,
  TheEnd = `the_end`,
  TheNether = `the_nether`
}