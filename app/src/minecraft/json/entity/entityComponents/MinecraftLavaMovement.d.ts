// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:lava_movement
 * 
 * minecraft:lava_movement Samples

Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

"minecraft:lava_movement": {
  "value": 0.32
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Lava Movement (minecraft:lava_movement)
 * Allows a custom movement speed across lava blocks.
 */
export default interface MinecraftLavaMovement {

  /**
   * @remarks
   * The speed the mob moves over a lava block.
   * 
   * Sample Values:
   * Strider: 0.32
   *
   */
  value: number;

}