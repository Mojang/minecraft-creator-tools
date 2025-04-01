// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:player.level
 * 
 * minecraft:player.level Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:player.level": {
  "value": 0,
  "max": 24791
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Player Level (minecraft:player.level)
 * Defines the player's level.
 */
export default interface MinecraftPlayerLevel {

  /**
   * @remarks
   * The maximum player level value of the entity.
   * 
   * Sample Values:
   * Player: 24791
   *
   */
  max: number;

  /**
   * @remarks
   * The initial value of the player level.
   */
  value: number;

}