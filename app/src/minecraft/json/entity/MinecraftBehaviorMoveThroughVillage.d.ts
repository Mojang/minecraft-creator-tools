// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_through_village
 * 
 * minecraft:behavior.move_through_village Samples

Iron Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/iron_golem.json

"minecraft:behavior.move_through_village": {
  "priority": 3,
  "speed_multiplier": 0.6,
  "only_at_night": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move Through Village Behavior
 * (minecraft:behavior.move_through_village)
 * Can only be used by Villagers. Allows the villagers to create paths
 * around the village.
 */
export default interface MinecraftBehaviorMoveThroughVillage {

  /**
   * @remarks
   * If true, the mob will only move through the village during night
   * time
   * 
   * Sample Values:
   * Iron Golem: true
   *
   */
  only_at_night: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Iron Golem: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Iron Golem: 0.6
   *
   */
  speed_multiplier: number;

}