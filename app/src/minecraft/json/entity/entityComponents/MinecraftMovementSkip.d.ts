// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.skip
 * 
 * minecraft:movement.skip Samples

Rabbit - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/rabbit.json

"minecraft:movement.skip": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Skip Movement (minecraft:movement.skip)
 * This move control causes the mob to hop as it moves.
 */
export default interface MinecraftMovementSkip {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   */
  max_turn?: number;

}