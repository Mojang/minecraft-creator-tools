// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:fire_resistant
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Fire Resistant (minecraft:fire_resistant)
 * Determines whether the item is immune to burning when dropped in
 * fire or lava.
 */
export default interface MinecraftFireResistant {

  /**
   * @remarks
   * Determines whether the item is immune to burning when dropped in
   * fire or lava. Default value: true.
   */
  value?: boolean;

}