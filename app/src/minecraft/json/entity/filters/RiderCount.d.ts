// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:rider_count
 * 
 * minecraft:rider_count Samples
 * At Full..: 
{ "test": "rider_count", "subject": "self", "operator": "equals", "value": "0" }
 * At Short (using Defaults)..: 
{ "test": "rider_count", "value": "0" }

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/component_groups/minecraft:adult_harnessed/minecraft:interact/interactions/0/on_interact/filters/all_of/2/: 
{
  "test": "rider_count",
  "subject": "self",
  "operator": "equals",
  "value": 0
}

 * At /minecraft:entity/events/minecraft:on_passenger_mount/sequence/0/filters/: 
{
  "test": "rider_count",
  "subject": "self",
  "operator": "equals",
  "value": 1
}


Nautilus - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/nautilus.json

 * At /minecraft:entity/events/minecraft:on_saddled/sequence/0/filters/: 
{
  "test": "rider_count",
  "subject": "self",
  "operator": ">",
  "value": 0
}


Zombie Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_horse.json

 * At /minecraft:entity/component_groups/minecraft:horse_tamed/minecraft:interact/interactions/1/on_interact/filters/all_of/0/: 
{
  "test": "rider_count",
  "value": 0
}

 * At /minecraft:entity/component_groups/minecraft:horse_wild_with_rider/minecraft:environment_sensor/triggers/0/filters/: 
{
  "test": "rider_count",
  "subject": "self",
  "value": 0
}


Dream Turkey - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/chill_dreams/1_dream_turkey/behavior_packs/mamm_cds/entities/dream_turkey.json

{
  "test": "rider_count",
  "subject": "self",
  "operator": "==",
  "value": 0
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Rider Count (rider_count)
 * Returns the number of riders on this entity.
 */
export default interface RiderCount {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Happy Ghast: "equals"
   *
   * Nautilus: ">"
   *
   * Dream Turkey: "=="
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Happy Ghast: "self"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Happy Ghast: "rider_count"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) An integer value.
   * 
   * Sample Values:
   * Happy Ghast: 1
   *
   */
  value?: number;

}


export enum RiderCountOperator {
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


export enum RiderCountSubject {
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