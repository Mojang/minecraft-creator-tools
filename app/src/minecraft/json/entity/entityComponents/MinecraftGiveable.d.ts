// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:giveable
 * 
 * minecraft:giveable Samples

Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:giveable": {
  "triggers": {
    "cooldown": 3,
    "items": [
      "bamboo",
      "cake"
    ],
    "on_give": {
      "event": "minecraft:on_calm",
      "target": "self"
    }
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Giveable (minecraft:giveable)
 * Defines sets of items that can be used to trigger events when
 * used on this entity. The item will also be taken and placed in
 * the entity's inventory.
 */
export default interface MinecraftGiveable {

  /**
   * @remarks
   * An optional cool down in seconds to prevent spamming 
   * interactions.
   */
  cooldown?: number;

  /**
   * @remarks
   * The list of items that can be given to the entity to place in
   * their inventory.
   */
  items?: string[];

  /**
   * @remarks
   * Event to fire when the correct item is given.
   */
  on_give?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * 
   * Sample Values:
   * Panda: {"cooldown":3,"items":["bamboo","cake"],"on_give":{"event":"minecraft:on_calm","target":"self"}}
   *
   */
  triggers?: MinecraftGiveableTriggers;

}


/**
 * Triggers (triggers)
 */
export interface MinecraftGiveableTriggers {

  /**
   * @remarks
   * 
   * Sample Values:
   * Panda: 3
   *
   */
  cooldown?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Panda: ["bamboo","cake"]
   *
   */
  items?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Panda: {"event":"minecraft:on_calm","target":"self"}
   *
   */
  on_give?: string;

}