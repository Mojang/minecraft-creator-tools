// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_breach
 * 
 * minecraft:behavior.random_breach Samples

Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.random_breach": {
  "priority": 6,
  "interval": 50,
  "xz_dist": 6,
  "cooldown_time": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Breach Behavior (minecraft:behavior.random_breach)
 * Allows the mob to randomly break surface of the water.
 */
export default interface MinecraftBehaviorRandomBreach {

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   * 
   * Sample Values:
   * Dolphin: 2
   *
   */
  cooldown_time?: number;

  /**
   * @remarks
   * A random value to determine when to randomly move somewhere. This
   * has a 1/interval chance to choose this goal
   * 
   * Sample Values:
   * Dolphin: 50
   *
   */
  interval?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Dolphin: 6
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Distance in blocks on ground that the mob will look for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Dolphin: 6
   *
   */
  xz_dist?: number;

  /**
   * @remarks
   * Distance in blocks that the mob will look up or down for a new
   * spot to move to. Must be at least 1
   */
  y_dist?: number;

}