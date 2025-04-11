// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:leashable
 * 
 * minecraft:leashable Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:leashable": {
  "soft_distance": 4,
  "hard_distance": 6,
  "max_distance": 10
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:leashable": {}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:leashable": {
  "soft_distance": 4,
  "hard_distance": 6,
  "max_distance": 10,
  "can_be_stolen": true
}


Ocelot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ocelot.json

"minecraft:leashable": {
  "soft_distance": 4,
  "hard_distance": 6,
  "max_distance": 10,
  "on_leash": {
    "event": "minecraft:on_leash",
    "target": "self"
  },
  "on_unleash": {
    "event": "minecraft:on_unleash",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Leashable (minecraft:leashable)
 * Describes how this mob can be leashed to other items.
 */
export default interface MinecraftLeashable {

  /**
   * @remarks
   * If true, players can leash this entity even if it is already leashed
   * to another mob.
   * 
   * Sample Values:
   * Llama: true
   *
   *
   */
  can_be_stolen: boolean;

  /**
   * @remarks
   * Distance in blocks at which the leash stiffens, restricting 
   * movement.
   * 
   * Sample Values:
   * Allay: 6
   *
   *
   */
  hard_distance: number;

  /**
   * @remarks
   * Distance in blocks it which the leash breaks.
   * 
   * Sample Values:
   * Allay: 10
   *
   *
   */
  max_distance: number;

  /**
   * @remarks
   * Event to call when this entity is leashed.
   * 
   * Sample Values:
   * Ocelot: {"event":"minecraft:on_leash","target":"self"}
   *
   *
   */
  on_leash: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to call when this entity is unleashed.
   * 
   * Sample Values:
   * Ocelot: {"event":"minecraft:on_unleash","target":"self"}
   *
   *
   */
  on_unleash: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * When set to true, "on_unleash" does not trigger when the entity
   * gets unleashed for other reasons such as being stolen or the
   * leash breaking.
   */
  on_unleash_interact_only: boolean;

  /**
   * @remarks
   * Defines how this entity behaves when leashed to another entity. A
   * preset is selected upon leashing and remains until the entity is
   * leashed to something else. The first preset whose "filter" conditions
   * are met will be applied; if none match, a default configuration is
   * used instead.
   */
  presets: MinecraftLeashablePresets[];

  /**
   * @remarks
   * Distance in blocks at which the 'spring' effect starts acting to
   * keep this entity close to the entity that leashed it.
   * 
   * Sample Values:
   * Allay: 4
   *
   *
   */
  soft_distance: number;

}


/**
 * Defines how this entity behaves when leashed to another entity. A
 * preset is selected upon leashing and remains until the entity is
 * leashed to something else. The first preset whose "filter" conditions
 * are met will be applied; if none match, a default configuration is
 * used instead.
 */
export interface MinecraftLeashablePresets {

  /**
   * @remarks
   * Conditions that must be met for this preset to be applied. These
   * conditions are only evaluated upon leashing.
   */
  filter: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Distance in blocks at which the leash stiffens, restricting 
   * movement.
   */
  hard_distance: number;

  /**
   * @remarks
   * Distance in blocks at which the leash breaks.
   */
  max_distance: number;

  /**
   * @remarks
   * Distance in blocks at which the "spring" effect starts acting to
   * keep this entity close to the entity that leashed it.
   */
  soft_distance: number;

}