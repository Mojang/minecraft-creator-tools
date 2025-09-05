// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:admire_item
 * 
 * minecraft:admire_item Samples

Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:admire_item": {
  "duration": 8,
  "cooldown_after_being_attacked": 20
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Admire Item (minecraft:admire_item)
 * Allows an entity to ignore attackable targets for a given
 * duration.
 */
export default interface MinecraftAdmireItem {

  /**
   * @remarks
   * Duration, in seconds, for which mob won't admire items if it
   * was hurt
   * 
   * Sample Values:
   * Piglin: 20
   *
   */
  cooldown_after_being_attacked?: number;

  /**
   * @remarks
   * Duration, in seconds, that the mob is pacified.
   * 
   * Sample Values:
   * Piglin: 8
   *
   */
  duration?: number;

}