// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:follow_range
 * 
 * minecraft:follow_range Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:follow_range": {
  "value": 1024
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:follow_range": {
  "value": 48,
  "max": 48
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:follow_range": {
  "value": 32
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:follow_range": {
  "value": 32,
  "max": 32
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:follow_range": {
  "value": 16,
  "max": 16
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:follow_range": {
  "value": 64,
  "max": 64
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:follow_range": {
  "value": 64
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:follow_range": {
  "value": 40,
  "max": 40
}


Polar Bear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/polar_bear.json

"minecraft:follow_range": {
  "value": 48
}


Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:follow_range": {
  "value": 128
}


Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:follow_range": 30
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Follow Range (minecraft:follow_range)
 * Defines the range, in blocks, that a mob will pursue a 
 * target.
 */
export default interface MinecraftFollowRange {

  /**
   * @remarks
   * Maximum distance the mob will go from a target.
   * 
   * Sample Values:
   * Blaze: 48
   *
   * Creaking: 32
   *
   *
   * Elder Guardian: 16
   *
   */
  max: number;

  /**
   * @remarks
   * The radius of the area of blocks the entity will attempt to
   * stay within around a target.
   * 
   * Sample Values:
   * Allay: 1024
   *
   *
   * Blaze: 48
   *
   * Breeze: 32
   *
   */
  value: number;

}