// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_liquid
 * 
 * minecraft:behavior.move_to_liquid Samples

Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

"minecraft:behavior.move_to_liquid": {
  "priority": 7,
  "search_range": 16,
  "search_height": 10,
  "goal_radius": 0.9,
  "material_type": "Lava",
  "search_count": 30
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Liquid Behavior (minecraft:behavior.move_to_liquid)
 * Allows the mob to move into a liquid when on land.
 */
export default interface MinecraftBehaviorMoveToLiquid {

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Strider: 0.9
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * The material type of the liquid block to find. Valid values are
   * "Any", "Water", and "Lava".
   * 
   * Sample Values:
   * Strider: "Lava"
   *
   */
  material_type?: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Strider: 7
   *
   */
  priority?: number;

  /**
   * @remarks
   * The number of blocks each tick that the mob will check within its
   * search range and height for a valid block to move to. A value of
   * 0 will have the mob check every block within range in one 
   * tick
   * 
   * Sample Values:
   * Strider: 30
   *
   */
  search_count?: number;

  /**
   * @remarks
   * Height in blocks the mob will look for the liquid block to move
   * towards
   * 
   * Sample Values:
   * Strider: 10
   *
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks it will look for the liquid block to
   * move towards
   * 
   * Sample Values:
   * Strider: 16
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier?: number;

}