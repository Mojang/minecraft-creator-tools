// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:can_destroy_in_creative
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Can Destroy In Creative
 * The can_destroy_in_creative component determines if the item can
 * be used by a player to break blocks when in creative mode.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface CanDestroyInCreative {

  /**
   * @remarks
   * Determines whether the item can be used to destroy blocks while in
   * creative mode.
   */
  value: boolean;

}