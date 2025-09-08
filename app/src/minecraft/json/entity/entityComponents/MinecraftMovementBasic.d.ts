// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.basic
 * 
 * minecraft:movement.basic Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:movement.basic": {}


Wither - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither.json

"minecraft:movement.basic": {
  "max_turn": 180
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Basic Movement (minecraft:movement.basic)
 * This component accents the movement of an entity.
 */
export default interface MinecraftMovementBasic {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   * 
   * Sample Values:
   * Wither: 180
   *
   */
  max_turn?: number;

}