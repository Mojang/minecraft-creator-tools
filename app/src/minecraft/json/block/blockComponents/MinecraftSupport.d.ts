// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:support
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Support (minecraft:support)
 * Defines the support shape of the block. Currently only allows for
 * blocks to have the same shape as a Vanilla fence and Vanilla stair.
 * To work with custom stairs, requires the use of
 * `minecraft:vertical_half` and `minecraft:cardinal_direction` or
 * `minecraft:facing_direction` which can be set through the
 * `minecraft:placement_direction` block trait. Custom blocks without
 * this component will default to unit cube support.
Experimental toggles
 * required: Upcoming Creator Features.
 */
export default interface MinecraftSupport {

  /**
   * @remarks
   * Required field. The type of support shape for this block.
   * Currently, the options are: `fence` and `stair`.
   */
  shape?: string;

}