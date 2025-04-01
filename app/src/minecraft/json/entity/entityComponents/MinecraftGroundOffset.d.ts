// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:ground_offset
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Ground Offset (minecraft:ground_offset)
 * Sets the offset from the ground that the entity is actually 
 * at.
 */
export default interface MinecraftGroundOffset {

  /**
   * @remarks
   * The value of the entity's offset from the terrain, in 
   * blocks.
   */
  value: number;

}