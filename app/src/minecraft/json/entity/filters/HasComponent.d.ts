// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Filters Documentation - minecraft:has_component
 * 
 * minecraft:has_component Samples
 * At Full..: 
{ "test": "has_component", "subject": "self", "operator": "equals", "value": "minecraft:explode" }
 * At Short (using Defaults)..: 
{ "test": "has_component", "value": "minecraft:explode" }

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

 * At /minecraft:entity/components/minecraft:behavior.nearest_attackable_target/entity_types/0/filters/all_of/1/: 
{
  "test": "has_component",
  "subject": "self",
  "operator": "!=",
  "value": "minecraft:attack_cooldown"
}

 * At /minecraft:entity/events/minecraft:entity_born/sequence/1/filters/: 
{
  "test": "has_component",
  "operator": "!=",
  "value": "minecraft:variant"
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

{
  "test": "has_component",
  "operator": "!=",
  "value": "minecraft:is_baby"
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

 * At /minecraft:entity/components/minecraft:interact/interactions/on_interact/filters/all_of/2/: 
{
  "test": "has_component",
  "operator": "!=",
  "value": "minecraft:explode"
}

 * At /minecraft:entity/events/minecraft:start_exploding_forced/sequence/0/filters/: 
{
  "test": "has_component",
  "operator": "!=",
  "value": "minecraft:is_charged"
}

 * At /minecraft:entity/events/minecraft:start_exploding_forced/sequence/1/filters/: 
{
  "test": "has_component",
  "value": "minecraft:is_charged"
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

 * At /minecraft:entity/events/minecraft:convert_to_zombie/sequence/1/filters/: 
{
  "test": "has_component",
  "value": "minecraft:is_baby"
}


Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

 * At /minecraft:entity/component_groups/minecraft:panda_baby/minecraft:behavior.sneeze/entity_types/0/filters/all_of/0/: 
{
  "test": "has_component",
  "subject": "other",
  "operator": "!=",
  "value": "minecraft:is_baby"
}

 * At /minecraft:entity/events/minecraft:panda_weak/sequence/1/filters/: 
{
  "test": "has_component",
  "operator": "==",
  "value": "minecraft:is_baby"
}


Sheep - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/sheep.json

 * At /minecraft:entity/components/minecraft:interact/interactions/0/on_interact/filters/all_of/3/: 
{
  "test": "has_component",
  "value": "minecraft:is_dyeable"
}

 * At /minecraft:entity/events/minecraft:on_eat_block/sequence/1/filters/: 
{
  "subject": "self",
  "test": "has_component",
  "operator": "!=",
  "value": "minecraft:is_baby"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Has Component (has_component)
 * Returns true when the subject entity contains the named 
 * component.
 */
export default interface HasComponent {

  /**
   * @remarks
   * (Optional) The comparison to apply with 'value'.
   * 
   * Sample Values:
   * Axolotl: "!="
   *
   * Panda: "=="
   *
   *
   */
  operator: string;

  /**
   * @remarks
   * (Optional) The subject of this filter test.
   * 
   * Sample Values:
   * Axolotl: "self"
   *
   * Panda: "other"
   *
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Axolotl: "has_component"
   *
   */
  test: string;

  /**
   * @remarks
   * (Required) The component name to look for
   * 
   * Sample Values:
   * Axolotl: "minecraft:attack_cooldown", "minecraft:variant"
   *
   * Cat: "minecraft:is_baby"
   *
   */
  value: string;

}


export enum HasComponentOperator {
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


export enum HasComponentSubject {
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