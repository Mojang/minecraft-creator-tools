// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_towards_target
 * 
 * minecraft:behavior.move_towards_target Samples

Iron Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/iron_golem.json

"minecraft:behavior.move_towards_target": {
  "priority": 2,
  "speed_multiplier": 0.9,
  "within_radius": 32
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move Towards Target Behavior 
 * (minecraft:behavior.move_towards_target)
 * Allows mob to move towards its current target.
 */
export default interface MinecraftBehaviorMoveTowardsTarget {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Iron Golem: 2
   *
   */
  priority: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Iron Golem: 0.9
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * Defines the radius in blocks that the mob tries to be from the
   * target. A value of 0 means it tries to occupy the same block as
   * the target
   * 
   * Sample Values:
   * Iron Golem: 32
   *
   */
  within_radius: number;

}