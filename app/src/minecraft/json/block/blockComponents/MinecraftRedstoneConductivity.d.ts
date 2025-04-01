// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:redstone_conductivity
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Redstone Conductivity (minecraft:redstone_conductivity)
 * The basic redstone properties of a block; if the component is
 * not provided the default values are used. Requires 1.21.30 format
 * version and above.
Experimental toggles required: Upcoming Creator
 * Features (in format versions before 1.21.30).
 */
export default interface MinecraftRedstoneConductivity {

  /**
   * @remarks
   * Specifies if redstone wire can stair-step downward on the 
   * block.
   */
  allows_wire_to_step_down: boolean;

  /**
   * @remarks
   * Specifies if the block can be powered by redstone.
   */
  redstone_conductor: boolean;

}