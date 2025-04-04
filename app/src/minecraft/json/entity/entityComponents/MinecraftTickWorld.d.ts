// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:tick_world
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Tick World (minecraft:tick_world)
 * Defines if the entity ticks the world and the radius around it
 * to tick.
 */
export default interface MinecraftTickWorld {

  /**
   * @remarks
   * The distance at which the closest player has to be before this
   * entity despawns. This option will be ignored if never_despawn is
   * true. Min: 128 blocks.
   */
  distance_to_players: number;

  /**
   * @remarks
   * If true, this entity will not despawn even if players are far
   * away. If false, distance_to_players will be used to determine when
   * to despawn.
   */
  never_despawn: boolean;

  /**
   * @remarks
   * The area around the entity to tick. Default: 2. Allowed range: 
   * 2-6.
   */
  radius: number;

}