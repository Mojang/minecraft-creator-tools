// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.sway
 * 
 * minecraft:movement.sway Samples

Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:movement.sway": {}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:movement.sway": {
  "sway_amplitude": 0
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Sway Movement (minecraft:movement.sway)
 * This move control causes the mob to sway side to side giving the
 * impression it is swimming.
 */
export default interface MinecraftMovementSway {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   */
  max_turn?: number;

  /**
   * @remarks
   * Strength of the sway movement.
   */
  sway_amplitude?: number;

  /**
   * @remarks
   * Multiplier for the frequency of the sway movement.
   */
  sway_frequency?: number;

}