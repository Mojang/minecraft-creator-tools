// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:water_movement
 * 
 * minecraft:water_movement Samples

Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:water_movement": {
  "drag_factor": 0.98
}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

"minecraft:water_movement": {
  "drag_factor": 0.9
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Water Movement (minecraft:water_movement)
 */
export default interface MinecraftWaterMovement {

  /**
   * @remarks
   * Drag factor to determine movement speed when in water.
   * 
   * Sample Values:
   * Panda: 0.98
   *
   *
   * Turtle: 0.9
   *
   *
   */
  drag_factor?: number;

}