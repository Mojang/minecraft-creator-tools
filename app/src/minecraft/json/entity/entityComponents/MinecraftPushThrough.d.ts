// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:push_through
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Push Through (minecraft:push_through)
 * Sets the distance through which the entity can push through.
 */
export default interface MinecraftPushThrough {

  /**
   * @remarks
   * The value of the entity's push-through, in blocks.
   */
  value?: number;

}