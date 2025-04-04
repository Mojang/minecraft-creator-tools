// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.generic
 * 
 * minecraft:movement.generic Samples

Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:movement.generic": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Generic Movement (minecraft:movement.generic)
 * This move control allows a mob to fly, swim, climb, etc.
 */
export default interface MinecraftMovementGeneric {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   */
  max_turn: number;

}