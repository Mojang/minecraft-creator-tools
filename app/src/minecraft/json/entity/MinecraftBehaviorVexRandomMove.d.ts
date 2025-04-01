// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.vex_random_move
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Vex Random Move Behavior 
 * (minecraft:behavior.vex_random_move)
 * Allows the mob to move around randomly like the Vex.
 * Note: No longer used for the `vex` entity. Instead,
 * `minecraft:navigation.walk` and `minecraft:behavior.float` allow
 * the `vex` entity to navigate.
 */
export default interface MinecraftBehaviorVexRandomMove {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

}