// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.amphibious
 * 
 * minecraft:movement.amphibious Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:movement.amphibious": {
  "max_turn": 15
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:movement.amphibious": {}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

"minecraft:movement.amphibious": {
  "max_turn": 5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Amphibious Movement (minecraft:movement.amphibious)
 * This move control allows the mob to swim in water and walk on
 * land.
 */
export default interface MinecraftMovementAmphibious {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   * 
   * Sample Values:
   * Axolotl: 15
   *
   * Turtle: 5
   *
   *
   */
  max_turn?: number;

}