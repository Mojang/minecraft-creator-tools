// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:balloonable
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Balloonable
 * Allows this entity to have a balloon attached and defines the
 * conditions and events for this entity when is ballooned.
 */
export default interface Balloonable {

  /**
   * @remarks
   * Mass that this entity will have when computing balloon pull
   * forces.
   */
  mass: number;

  /**
   * @remarks
   * Distance in blocks at which the balloon breaks.
   */
  max_distance: number;

  /**
   * @remarks
   * Event to call when this entity is ballooned.
   */
  on_balloon: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to call when this entity is unballooned.
   */
  on_unballoon: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Distance in blocks at which the 'spring' effect that lifts 
   * it.
   */
  soft_distance: number;

}