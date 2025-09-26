// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:home
 * 
 * minecraft:home Samples

Nardolphle - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/nardolphle.behavior.json

"minecraft:home": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Home (minecraft:home)
 * Saves a home position for when the the entity is spawned.
 */
export default interface MinecraftHome {

  /**
   * @remarks
   * Optional list of blocks that can be considered a valid home. If
   * no such block longer exists at that position,
											the home
   * restriction is removed. Example syntax: minecraft:sand. Not
   * supported: minecraft:sand:1.
   */
  home_block_list?: string[];

  /**
   * @remarks
   * Optional radius that the entity will be restricted to in
   * relation to its home.
   */
  restriction_radius?: number;

  /**
   * @remarks
   * Defines how the the entity will be restricted to its home
   * position. The possible values are:
												\n- "none", which
   * poses no restriction.
												\n- "random_movement", which
   * restricts randomized movement to be around the home
   * position.
												\n- "all_movement", which restricts any
   * kind of movement to be around the home
   * position.
													However, entities that somehow got too
   * far away from their home will always be able to move closer to
   * it, if prompted to do so.
   */
  restriction_type?: string;

}