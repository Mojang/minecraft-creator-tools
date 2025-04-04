// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:player.experience
 * 
 * minecraft:player.experience Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:player.experience": {
  "value": 0,
  "max": 1
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Player Experience (minecraft:player.experience)
 * Defines how much experience each player action should take.
 */
export default interface MinecraftPlayerExperience {

  /**
   * @remarks
   * The maximum player experience of this entity.
   * 
   * Sample Values:
   * Player: 1
   *
   */
  max: number;

  /**
   * @remarks
   * The initial value of the player experience.
   */
  value: number;

}