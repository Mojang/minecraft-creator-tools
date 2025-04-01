// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:chargeable
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Chargeable
 * Event trigger for when the item has completed its use 
 * duration.
 * IMPORTANT
 * This type is now deprecated, and no longer in use in the latest versions of Minecraft.
 * 
 */
export default interface Chargeable {

  /**
   * @remarks
   * Modifier value to scale the players movement speed when item is
   * in use.
   */
  movement_modifier: number;

  /**
   * @remarks
   * Event trigger for when the item has completed its use 
   * duration.
   */
  on_complete: object;

}