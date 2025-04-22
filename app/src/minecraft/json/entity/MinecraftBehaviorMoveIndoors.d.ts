// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_indoors
 * 
 * minecraft:behavior.move_indoors Samples

Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.move_indoors": {
  "priority": 6,
  "speed_multiplier": 0.8,
  "timeout_cooldown": 8
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.move_indoors": {
  "priority": 4,
  "speed_multiplier": 0.8
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move Indoors Behavior (minecraft:behavior.move_indoors)
 * Allows this entity to move indoors.
 */
export default interface MinecraftBehaviorMoveIndoors {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager V2: 6
   *
   * Villager: 4
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * The movement speed modifier to apply to the entity while it is
   * moving indoors.
   * 
   * Sample Values:
   * Villager V2: 0.8
   *
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The cooldown time in seconds before the goal can be reused after
   * pathfinding fails
   * 
   * Sample Values:
   * Villager V2: 8
   *
   *
   */
  timeout_cooldown: number;

}