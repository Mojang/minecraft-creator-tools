// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_poi
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Poi Behavior (minecraft:behavior.move_to_poi)
 * Allows the mob to move to a POI if able to.
 */
export default interface MinecraftBehaviorMoveToPoi {

  /**
   * @remarks
   * Tells the goal what POI type it should be looking for
   */
  poi_type?: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier?: number;

}