// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:is_skin_id
 * 
 * minecraft:is_skin_id Samples
 * At Full..: 
{ "test": "is_skin_id", "subject": "self", "operator": "equals", "value": "0" }
 * At Short (using Defaults)..: 
{ "test": "is_skin_id", "value": "0" }

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/events/minecraft:entity_transformed/sequence/2/sequence/0/filters/: 
{
  "test": "is_skin_id",
  "subject": "other",
  "value": 0
}

 * At /minecraft:entity/events/minecraft:entity_transformed/sequence/2/sequence/1/filters/: 
{
  "test": "is_skin_id",
  "subject": "other",
  "value": 1
}

 * At /minecraft:entity/events/minecraft:entity_transformed/sequence/2/sequence/2/filters/: 
{
  "test": "is_skin_id",
  "subject": "other",
  "value": 2
}

 * At /minecraft:entity/events/minecraft:entity_transformed/sequence/2/sequence/3/filters/: 
{
  "test": "is_skin_id",
  "subject": "other",
  "value": 3
}

 * At /minecraft:entity/events/minecraft:entity_transformed/sequence/2/sequence/4/filters/: 
{
  "test": "is_skin_id",
  "subject": "other",
  "value": 4
}

 * At /minecraft:entity/events/minecraft:entity_transformed/sequence/2/sequence/5/filters/: 
{
  "test": "is_skin_id",
  "subject": "other",
  "value": 5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Skin Id (is_skin_id)
 * Returns true if the subject entity is the skin id number 
 * provided.
 */
export default interface IsSkinId {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   */
  operator?: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Villager v2: "other"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager v2: "is_skin_id"
   *
   */
  test?: string;

  /**
   * @remarks
   * (Required) An integer value.
   * 
   * Sample Values:
   * Villager v2: 1, 2, 3, 4, 5
   *
   */
  value?: number;

}


export enum IsSkinIdOperator {
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


export enum IsSkinIdSubject {
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