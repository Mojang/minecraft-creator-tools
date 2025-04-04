// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:player.exhaustion
 * 
 * minecraft:player.exhaustion Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:player.exhaustion": {
  "value": 0,
  "max": 20
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Player Exhaustion (minecraft:player.exhaustion)
 * Defines the player's exhaustion level.
 */
export default interface MinecraftPlayerExhaustion {

  /**
   * @remarks
   * A maximum value for a player's exhaustion.
   * 
   * Sample Values:
   * Player: 20
   *
   */
  max: number;

  /**
   * @remarks
   * The initial value of a player's exhaustion level.
   */
  value: number;

}