// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.float_tempt
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Float Tempt Behavior (minecraft:behavior.float_tempt)
 * Allows a mob to be tempted by a player holding a specific item.
 * Uses point-to-point movement. Designed for mobs that are
 * floating (e.g. use the "minecraft:navigation.float" 
 * component).
 */
export default interface MinecraftBehaviorFloatTempt {

  /**
   * @remarks
   * If true, the mob can stop being tempted if the player moves too
   * fast while close to this mob.
   */
  can_get_scared: boolean;

  /**
   * @remarks
   * If true, vertical distance to the player will be considered when
   * tempting.
   */
  can_tempt_vertically: boolean;

  /**
   * @remarks
   * If true, the mob can be tempted even if it has a passenger (i.e.
   * if being ridden).
   */
  can_tempt_while_ridden: boolean;

  /**
   * @remarks
   * List of items that can tempt the mob.
   */
  items: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

  /**
   * @remarks
   * Range of random ticks to wait between tempt sounds.
   */
  sound_interval: number[];

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The distance at which the mob will stop following the 
   * player.
   */
  stop_distance: number;

  /**
   * @remarks
   * Sound to play while the mob is being tempted.
   */
  tempt_sound: string;

  /**
   * @remarks
   * Distance in blocks this mob can get tempted by a player holding an
   * item they like.
   */
  within_radius: number;

}