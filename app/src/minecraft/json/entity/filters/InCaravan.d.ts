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
      "deals_damage": "yes"
    }
  }
}

 * At /minecraft:entity/components/minecraft:damage_sensor/triggers/on_damage/filters/: 
{
  "test": "in_caravan",
  "value": false
}


Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

 * At /minecraft:entity/component_groups/minecraft:in_caravan/: 
{
  "minecraft:damage_sensor": {
    "triggers": {
      "cause": "all",
      "deals_damage": true
    }
  }
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
   * Llama: {"triggers":{"cause":"all","deals_damage":"yes"}}
   *
   * Frost Moose: {"triggers":{"cause":"all","deals_damage":true}}
   *
   *
   */
  "minecraft:damage_sensor"?: InCaravanMinecraftDamageSensor;

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
   * Llama: "in_caravan"
   *
   *
   */
  test?: string;

  /**
   * @remarks
   * (Optional) true or false.
   */
  value?: boolean;

}


/**
 * Minecraft:damage sensor (minecraft:damage_sensor)
 */
export interface InCaravanMinecraftDamageSensor {

  /**
   * @remarks
   * 
   * Sample Values:
   * Llama: {"cause":"all","deals_damage":"yes"}
   *
   */
  triggers?: string;

}


export enum InCaravanOperator {
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


export enum InCaravanSubject {
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