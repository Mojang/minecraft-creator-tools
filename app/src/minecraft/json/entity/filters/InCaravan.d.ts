// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:in_caravan
 * 
 * minecraft:in_caravan Samples
 * At Full..: 
{ "test": "in_caravan", "subject": "self", "operator": "equals", "value": "true" }
 * At Short (using Defaults)..: 
{ "test": "in_caravan" }

Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

 * At /minecraft:entity/component_groups/minecraft:in_caravan/: 
{
  "minecraft:damage_sensor": {
    "triggers": {
      "cause": "all",
      "deals_damage": true
    }
  }
}

 * At /minecraft:entity/components/minecraft:damage_sensor/triggers/on_damage/filters/: 
{
  "test": "in_caravan",
  "value": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * In Caravan (in_caravan)
 * Returns true if the subject entity is in a caravan.
 * Note: Does not require any parameters to work properly. It can
 * be used as a standalone filter.
 */
export default interface InCaravan {

  /**
   * @remarks
   * 
   * Sample Values:
   * Llama: {"triggers":{"cause":"all","deals_damage":true}}
   *
   *
   */
  "minecraft:damage_sensor": InCaravanMinecraftDamageSensor;

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
   * Llama: "in_caravan"
   *
   *
   */
  test: string;

  /**
   * @remarks
   * (Optional) true or false.
   */
  value: boolean;

}


/**
 * Minecraft:damage_sensor (minecraft:damage_sensor)
 */
export interface InCaravanMinecraftDamageSensor {

  /**
   * @remarks
   * 
   * Sample Values:
   * Llama: {"cause":"all","deals_damage":true}
   *
   */
  triggers: string;

}


export enum InCaravanOperator {
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


export enum InCaravanSubject {
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