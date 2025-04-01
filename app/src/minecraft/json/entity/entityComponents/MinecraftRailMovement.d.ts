// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:rail_movement
 * 
 * minecraft:rail_movement Samples

Chest Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chest_minecart.json

"minecraft:rail_movement": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Rail Movement (minecraft:rail_movement)
 * Defines the entity's movement on the rails. An entity with this
 * component is only allowed to move on the rail.
 */
export default interface MinecraftRailMovement {

  /**
   * @remarks
   * Maximum speed that this entity will move at when on the 
   * rail.
   */
  max_speed: number;

}