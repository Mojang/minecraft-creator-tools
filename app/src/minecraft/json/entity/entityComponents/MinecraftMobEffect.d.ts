// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:mob_effect
 * 
 * minecraft:mob_effect Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Mob Effect (minecraft:mob_effect)
 * A component that applies a mob effect to entities that get
 * within range.
 */
export default interface MinecraftMobEffect {

  /**
   * @remarks
   * Time in seconds to wait between each application of the 
   * effect.
   */
  cooldown_time?: number;

  /**
   * @remarks
   * How close a hostile entity must be to have the mob effect 
   * applied.
   */
  effect_range?: number;

  /**
   * @remarks
   * How long the applied mob effect lasts in seconds. Can also be
   * set to "infinite"
   */
  effect_time?: number;

  /**
   * @remarks
   * The set of entities that are valid to apply the mob effect 
   * to.
   */
  entity_filter?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The mob effect that is applied to entities that enter this
   * entities effect range.
   */
  mob_effect?: string;

}