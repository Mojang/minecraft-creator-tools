// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:jump.static
 * 
 * minecraft:jump.static Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:jump.static": {}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:jump.static": {
  "jump_power": 0.6
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Static Jump (minecraft:jump.static)
 * Gives the entity the ability to jump.
 */
export default interface MinecraftJumpStatic {

  /**
   * @remarks
   * The initial vertical velocity for the jump
   * 
   * Sample Values:
   * Dolphin: 0.6
   *
   */
  jump_power?: number;

}