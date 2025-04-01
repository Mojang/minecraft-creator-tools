// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.door_interact
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Door Interact Behavior (minecraft:behavior.door_interact)
 * Allows the mob to open and close doors.
 * Note: Not currently used by any entities within Minecraft: Bedrock
 * Edition.
 */
export default interface MinecraftBehaviorDoorInteract {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

}