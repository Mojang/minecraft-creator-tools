// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:ignore_cannot_be_attacked
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Ignore Cannot Be Attacked 
 * (minecraft:ignore_cannot_be_attacked)
 * When set, blocks entities from attacking the owner entity unless
 * they have the "minecraft:ignore_cannot_be_attacked" 
 * component.
 */
export default interface MinecraftIgnoreCannotBeAttacked {

  /**
   * @remarks
   * Defines which entities are exceptions and are allowed to be
   * attacked by the owner entity, potentially attacked entity is
   * subject "other". If this is not specified then all attacks by
   * the owner are allowed.
   */
  filters: jsoncommon.MinecraftFilter;

}