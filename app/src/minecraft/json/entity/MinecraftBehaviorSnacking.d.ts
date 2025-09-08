// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.snacking
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Snacking Behavior (minecraft:behavior.snacking)
 * Allows the mob to take a load off and snack on food that it
 * found nearby.
 */
export default interface MinecraftBehaviorSnacking {

  /**
   * @remarks
   * Items that we are interested in snacking on
   */
  items?: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

  /**
   * @remarks
   * The cooldown time in seconds before the mob is able to snack 
   * again
   */
  snacking_cooldown?: number;

  /**
   * @remarks
   * The minimum time in seconds before the mob is able to snack 
   * again
   */
  snacking_cooldown_min?: number;

  /**
   * @remarks
   * This is the chance that the mob will stop snacking, from 0 to 
   * 1
   */
  snacking_stop_chance?: number;

}