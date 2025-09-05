// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:player.saturation
 * 
 * minecraft:player.saturation Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:player.saturation": {
  "value": 5,
  "max": 20
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Player Saturation (minecraft:player.saturation)
 * Defines the player's need for food.
 */
export default interface MinecraftPlayerSaturation {

  /**
   * @remarks
   * The maximum player saturation value.
   * 
   * Sample Values:
   * Player: 20
   *
   */
  max?: number;

  /**
   * @remarks
   * The initial value of player saturation.
   * 
   * Sample Values:
   * Player: 5
   *
   */
  value?: number;

}