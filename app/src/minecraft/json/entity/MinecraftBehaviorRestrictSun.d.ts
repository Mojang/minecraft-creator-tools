// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.restrict_sun
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Restrict Sun Behavior (minecraft:behavior.restrict_sun)
 * Allows the mob to automatically start avoiding the sun when its
 * a clear day out.
 */
export default interface MinecraftBehaviorRestrictSun {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

}