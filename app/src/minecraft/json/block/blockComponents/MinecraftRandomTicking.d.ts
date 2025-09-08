// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:random_ticking
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Random Ticking (minecraft:random_ticking)
 * Triggers the specified event randomly based on the random tick
 * speed gamerule. The random tick speed determines how often blocks
 * are updated. Some other examples of game mechanics that use
 * random ticking are crop growth and fire spreading.
 * IMPORTANT
 * This type is now deprecated, and no longer in use in the latest versions of Minecraft.
 * 
 */
export default interface MinecraftRandomTicking {

  /**
   * @remarks
   * The event that will be triggered on random ticks.
   */
  on_tick?: jsoncommon.MinecraftEventTrigger;

}