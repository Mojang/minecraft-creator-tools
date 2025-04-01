// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:allow_off_hand
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Allow Off Hand
 * The allow_off_hand component determines whether the item can be
 * placed in the off hand slot of the inventory.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface AllowOffHand {

  /**
   * @remarks
   * Determines whether the item can be placed in the off hand 
   * slot.
   */
  value: boolean;

}