// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:horse.jump_strength
 * 
 * minecraft:horse.jump_strength Samples

Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:horse.jump_strength": {
  "value": 0.5
}


Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/horse.json

"minecraft:horse.jump_strength": {
  "value": {
    "range_min": 0.4,
    "range_max": 1
  }
}


Zombie Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_horse.json

"minecraft:horse.jump_strength": {
  "value": {
    "range_min": 0.5,
    "range_max": 0.7
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Horse Jump Strength (minecraft:horse.jump_strength)
 * Determines the jump height for a horse or similar entity, like a
 * donkey.
 */
export default interface MinecraftHorseJumpStrength {

  /**
   * @remarks
   * Value of jump strength the entity has when spawned.
   * 
   * Sample Values:
   * Donkey: 0.5
   *
   * Horse: {"range_min":0.4,"range_max":1}
   *
   *
   *
   * Zombie Horse: {"range_min":0.5,"range_max":0.7}
   *
   */
  value?: MinecraftHorseJumpStrengthValue[];

}


/**
 * Describes the range of jump strength.
 */
export interface MinecraftHorseJumpStrengthValue {

  /**
   * @remarks
   * Defines the maximum strength level.
   */
  range_max?: number;

  /**
   * @remarks
   * Defines the minimum strength level.
   */
  range_min?: number;

}