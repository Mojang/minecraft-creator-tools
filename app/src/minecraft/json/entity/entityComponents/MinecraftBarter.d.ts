// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:barter
 * 
 * minecraft:barter Samples

Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:barter": {
  "barter_table": "loot_tables/entities/piglin_barter.json",
  "cooldown_after_being_attacked": 20
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Barter (minecraft:barter)
 * Enables the component to drop an item as a barter exchange.
 */
export default interface MinecraftBarter {

  /**
   * @remarks
   * Loot table that's used to drop a random item.
   * 
   * Sample Values:
   * Piglin: "loot_tables/entities/piglin_barter.json"
   *
   */
  barter_table?: string;

  /**
   * @remarks
   * Duration, in seconds, for which mob won't barter items if it
   * was hurt.
   * 
   * Sample Values:
   * Piglin: 20
   *
   */
  cooldown_after_being_attacked?: number[];

}