// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:should_despawn
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Should Despawn
 * Should_despawn component determines if the item should eventually
 * despawn while floating in the world.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface ShouldDespawn {

  /**
   * @remarks
   * Determines whether the item should eventually despawn while
   * floating in the world.
   */
  value: boolean;

}