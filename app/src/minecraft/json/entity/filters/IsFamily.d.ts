// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_family
 * 
 * minecraft:is_family Samples
 * At Full..: 
{ "test": "is_family", "subject": "self", "operator": "equals", "value": "player" }
 * At Short (using Defaults)..: 
{ "test": "is_family", "value": "player" }

Arrow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/arrow.json

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/1/filters/: 
{
  "test": "is_family",
  "subject": "other",
  "value": "player"
}

 * At /minecraft:entity/events/minecraft:entity_spawned/sequence/2/filters/: 
{
  "test": "is_family",
  "subject": "other",
  "value": "pillager"
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/angry_bee/minecraft:angry/broadcast_filters/: 
{
  "test": "is_family",
  "operator": "!=",
  "value": "pacified"
}

 * At /minecraft:entity/events/hive_destroyed/sequence/0/filters/: 
{
  "test": "is_family",
  "subject": "self",
  "operator": "!=",
  "value": "pacified"
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "breeze"
}

 * At /minecraft:entity/components/minecraft:behavior.nearest_attackable_target/entity_types/1/filters/: 
{
  "test": "is_family",
  "subject": "other",
  "value": "irongolem"
}

 * At /minecraft:entity/components/minecraft:behavior.nearest_attackable_target/entity_types/2/filters/all_of/0/: 
{
  "test": "is_family",
  "subject": "other",
  "value": "baby_turtle"
}

 * At /minecraft:entity/components/minecraft:behavior.avoid_mob_type/entity_types/0/filters/: 
{
  "test": "is_family",
  "subject": "other",
  "value": "wolf"
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

 * At /minecraft:entity/components/minecraft:damage_sensor/triggers/1/on_damage/filters/: 
{
  "test": "is_family",
  "subject": "damager",
  "operator": "!=",
  "value": "wind_charge"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/0/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "skeleton"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/1/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "stray"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/2/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "zombie"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/3/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "husk"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/4/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "spider"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/5/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "cavespider"
}

 * At /minecraft:entity/components/minecraft:behavior.hurt_by_target/entity_types/0/filters/all_of/6/: 
{
  "test": "is_family",
  "subject": "other",
  "operator": "!=",
  "value": "slime"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Family (is_family)
 * Returns true when the subject entity is a member of the named
 * family.
 */
export default interface IsFamily {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Bee: "!="
   *
   * Fox: "=="
   *
   * Iron Golem: "not"
   *
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Arrow: "other"
   *
   * Bee: "self"
   *
   * Breeze: "damager"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Arrow: "is_family"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) The Family name to look for
   * 
   * Sample Values:
   * Arrow: "player", "pillager"
   *
   * Bee: "pacified"
   *
   */
  value?: string;

}


export enum IsFamilyOperator {
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


export enum IsFamilySubject {
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