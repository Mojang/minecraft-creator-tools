// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_fly
 * 
 * minecraft:behavior.random_fly Samples

Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:behavior.random_fly": {
  "priority": 3,
  "xz_dist": 15,
  "y_dist": 1,
  "y_offset": 0,
  "speed_multiplier": 1,
  "can_land_on_trees": true,
  "avoid_damage_blocks": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Fly Behavior (minecraft:behavior.random_fly)
 * Allows a mob to randomly fly around.
 */
export default interface MinecraftBehaviorRandomFly {

  /**
   * @remarks
   * 
   * Sample Values:
   * Parrot: true
   *
   */
  avoid_damage_blocks?: string;

  /**
   * @remarks
   * If true, the mob can stop flying and land on a tree instead of
   * the ground
   * 
   * Sample Values:
   * Parrot: true
   *
   */
  can_land_on_trees?: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Parrot: 3
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Parrot: 1
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Distance in blocks on ground that the mob will look for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Parrot: 15
   *
   */
  xz_dist?: number;

  /**
   * @remarks
   * Distance in blocks that the mob will look up or down for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Parrot: 1
   *
   */
  y_dist?: number;

  y_offset?: number;

}