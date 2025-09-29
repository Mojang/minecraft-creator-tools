// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:on_death
 * 
 * minecraft:on_death Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * On Death (minecraft:on_death)
 * Adds a trigger to call on this entity's death.
 */
export default interface MinecraftOnDeath {

  /**
   * @remarks
   * The event to run when the conditions for this trigger are 
   * met.
   */
  event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The list of conditions for this trigger to execute.
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The target of the event.
   */
  target?: string;

}