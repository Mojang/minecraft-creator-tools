// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:damage
 * 
 * minecraft:damage Samples
"minecraft:damage": {
  "minecraft:damage": 2
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Damage
 * The damage component determines how much extra damage the item
 * does on attack.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Integer number`.

 */
export default interface Damage {

  /**
   * @remarks
   * Specifies how much extra damage the item does, must be a
   * positive number.
   */
  value: number;

}