// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:on_hurt
 * 
 * minecraft:on_hurt Samples

Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:on_hurt": {
  "event": "minecraft:on_hurt_event",
  "target": "self"
}


Ender Crystal - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_crystal.json

"minecraft:on_hurt": {
  "event": "minecraft:crystal_explode",
  "target": "self"
}


Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

 * At /minecraft:entity/component_groups/minecraft:illager_squad_captain/minecraft:on_hurt/: 
"minecraft:on_hurt": {
  "event": "minecraft:ranged_mode",
  "target": "self"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * On Hurt (minecraft:on_hurt)
 * Adds a trigger to call when this entity takes damage.
 */
export default interface MinecraftOnHurt {

  /**
   * @remarks
   * The event to run when the conditions for this trigger are 
   * met.
   * 
   * Sample Values:
   * Blaze: "minecraft:on_hurt_event"
   *
   * Ender Crystal: "minecraft:crystal_explode"
   *
   * Pillager: "minecraft:ranged_mode"
   *
   */
  event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The list of conditions for this trigger to execute.
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The target of the event.
   * 
   * Sample Values:
   * Blaze: "self"
   *
   *
   */
  target: string;

}