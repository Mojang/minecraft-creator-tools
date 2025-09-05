// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.break_door
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Break Door Behavior (minecraft:behavior.break_door)
 * Allows this mob to break doors.
 * Note: Not currently used by any entities within Minecraft: Bedrock
 * Edition. In its place, the parameter `can_break_doors` has been
 * added to the `minecraft:navigation` component to allow entities to
 * break down doors.
 */
export default interface MinecraftBehaviorBreakDoor {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

}