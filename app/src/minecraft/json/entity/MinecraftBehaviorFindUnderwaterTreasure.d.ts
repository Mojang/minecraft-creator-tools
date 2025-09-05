// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.find_underwater_treasure
 * 
 * minecraft:behavior.find_underwater_treasure Samples

Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.find_underwater_treasure": {
  "priority": 2,
  "speed_multiplier": 2,
  "search_range": 30,
  "stop_distance": 50
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Find Underwater Treasure Behavior
 * (minecraft:behavior.find_underwater_treasure)
 * Allows the mob to move towards the nearest underwater ruin or
 * shipwreck.
 */
export default interface MinecraftBehaviorFindUnderwaterTreasure {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Dolphin: 2
   *
   */
  priority?: number;

  /**
   * @remarks
   * The range that the mob will search for a treasure chest within a
   * ruin or shipwreck to move towards.
   * 
   * Sample Values:
   * Dolphin: 30
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Dolphin: 2
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * The distance the mob will move before stopping.
   * 
   * Sample Values:
   * Dolphin: 50
   *
   */
  stop_distance?: number;

}