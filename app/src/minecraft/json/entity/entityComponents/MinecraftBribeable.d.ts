// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:bribeable
 * 
 * minecraft:bribeable Samples

Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:bribeable": {
  "bribe_items": [
    "fish",
    "salmon"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Bribeable (minecraft:bribeable)
 * Defines the way an entity can get into the 'bribed' state.
 */
export default interface MinecraftBribeable {

  /**
   * @remarks
   * Time in seconds before the Entity can be bribed again.
   */
  bribe_cooldown?: number;

  /**
   * @remarks
   * The list of items that can be used to bribe the entity.
   * 
   * Sample Values:
   * Dolphin: ["fish","salmon"]
   *
   */
  bribe_items?: string[];

}