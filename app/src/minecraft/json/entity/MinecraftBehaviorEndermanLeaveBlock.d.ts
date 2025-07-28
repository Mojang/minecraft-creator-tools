// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.enderman_leave_block
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Enderman Leave Block Behavior
 * (minecraft:behavior.enderman_leave_block)
 * Allows the enderman to drop a block they are carrying.
 */
export default interface MinecraftBehaviorEndermanLeaveBlock {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

}