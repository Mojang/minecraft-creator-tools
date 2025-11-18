// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:has_biome_tag
 * 
 * minecraft:has_biome_tag Samples
 * At Full..: 
{ "test": "has_biome_tag", "subject": "self", "operator": "equals", "value": " " }
 * At Short (using Defaults)..: 
{ "test": "has_biome_tag", "value": " " }

Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/events/minecraft:entity_spawned_with_biome_specific_jockey/first_valid/1/filters/all_of/2/any_of/0/: 
{
  "test": "has_biome_tag",
  "value": "swamp"
}

 * At /minecraft:entity/events/minecraft:entity_spawned_with_biome_specific_jockey/first_valid/1/filters/all_of/2/any_of/1/: 
{
  "test": "has_biome_tag",
  "value": "mangrove_swamp"
}

 * At /minecraft:entity/events/minecraft:entity_spawned_with_biome_specific_jockey/first_valid/2/filters/all_of/2/: 
{
  "test": "has_biome_tag",
  "value": "desert"
}

 * At /minecraft:entity/events/minecraft:entity_spawned_with_biome_specific_jockey/first_valid/3/filters/: 
{
  "test": "has_biome_tag",
  "value": "nether"
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/1/first_valid/0/filters/: 
{
  "test": "has_biome_tag",
  "value": "spawns_warm_variant_farm_animals"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/1/first_valid/1/filters/: 
{
  "test": "has_biome_tag",
  "value": "spawns_cold_variant_farm_animals"
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/2/filters/any_of/1/: 
{
  "test": "has_biome_tag",
  "value": "mesa"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/3/filters/: 
{
  "test": "has_biome_tag",
  "value": "jungle"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/4/filters/: 
{
  "test": "has_biome_tag",
  "value": "savanna"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/5/filters/any_of/0/all_of/0/: 
{
  "test": "has_biome_tag",
  "value": "cold"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/5/filters/any_of/0/all_of/1/: 
{
  "test": "has_biome_tag",
  "operator": "!=",
  "value": "ocean"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/5/filters/any_of/1/: 
{
  "test": "has_biome_tag",
  "value": "frozen"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/7/filters/all_of/0/any_of/0/: 
{
  "test": "has_biome_tag",
  "value": "taiga"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/7/filters/all_of/0/any_of/1/: 
{
  "test": "has_biome_tag",
  "value": "extreme_hills"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/7/filters/all_of/1/: 
{
  "test": "has_biome_tag",
  "operator": "!=",
  "value": "cold"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Has Biome Tag (has_biome_tag)
 * Tests whether the biome the subject is in has the specified 
 * tag.
 */
export default interface HasBiomeTag {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Villager v2: "!="
   *
   * Wolf: "not"
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
   * Cave Spider: "has_biome_tag"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) The tag to look for
   * 
   * Sample Values:
   * Cave Spider: "swamp", "mangrove_swamp", "desert", "nether"
   *
   */
  value?: string;

}


export enum HasBiomeTagOperator {
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


export enum HasBiomeTagSubject {
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