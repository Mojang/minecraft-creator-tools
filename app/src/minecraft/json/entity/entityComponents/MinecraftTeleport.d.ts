// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:teleport
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Teleport (minecraft:teleport)
 * Defines an entity's teleporting behavior.
 */
export default interface MinecraftTeleport {

  /**
   * @remarks
   * Modifies the chance that the entity will teleport if the entity is
   * in darkness
   */
  dark_teleport_chance: number;

  /**
   * @remarks
   * Modifies the chance that the entity will teleport if the entity is
   * in daylight
   */
  light_teleport_chance: number;

  /**
   * @remarks
   * Maximum amount of time in seconds between random teleports
   */
  max_random_teleport_time: number;

  /**
   * @remarks
   * Minimum amount of time in seconds between random teleports
   */
  min_random_teleport_time: number;

  /**
   * @remarks
   * Entity will teleport to a random position within the area defined by
   * this cube
   */
  random_teleport_cube: number[];

  /**
   * @remarks
   * If true, the entity will teleport randomly
   */
  random_teleports: boolean;

  /**
   * @remarks
   * Maximum distance the entity will teleport when chasing a
   * target
   */
  target_distance: number;

  /**
   * @remarks
   * The chance that the entity will teleport between 0.0 and 1.0. 1.0
   * means 100%
   */
  target_teleport_chance: number;

}