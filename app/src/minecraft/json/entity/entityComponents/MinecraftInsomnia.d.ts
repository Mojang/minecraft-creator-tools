// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:insomnia
 * 
 * minecraft:insomnia Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:insomnia": {
  "days_until_insomnia": 3
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Insomnia (minecraft:insomnia)
 * Adds a timer since last rested to see if phantoms should 
 * spawn.
 */
export default interface MinecraftInsomnia {

  /**
   * @remarks
   * Number of days the mob has to stay up until the insomnia effect
   * begins.
   * 
   * Sample Values:
   * Player: 3
   *
   */
  days_until_insomnia: number;

}