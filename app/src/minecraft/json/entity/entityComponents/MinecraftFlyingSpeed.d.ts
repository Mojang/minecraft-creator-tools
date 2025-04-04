// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:flying_speed
 * 
 * minecraft:flying_speed Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:flying_speed": {
  "value": 0.1
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:flying_speed": {
  "value": 0.15
}


Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:flying_speed": {
  "value": 0.6
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Flying Speed (minecraft:flying_speed)
 * Speed in Blocks that this entity flies at.
 */
export default interface MinecraftFlyingSpeed {

  /**
   * @remarks
   * Flying speed in blocks per tick.
   * 
   * Sample Values:
   * Allay: 0.1
   *
   * Bee: 0.15
   *
   * Ender Dragon: 0.6
   *
   */
  value: number;

}