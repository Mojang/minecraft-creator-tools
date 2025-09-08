// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_to_random_block
 * 
 * minecraft:behavior.move_to_random_block Samples

Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

"minecraft:behavior.move_to_random_block": {
  "priority": 6,
  "speed_multiplier": 0.55,
  "within_radius": 8,
  "block_distance": 512
}


Vindicator - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vindicator.json

"minecraft:behavior.move_to_random_block": {
  "priority": 5,
  "speed_multiplier": 0.55,
  "within_radius": 8,
  "block_distance": 512
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move To Random Block Behavior
 * (minecraft:behavior.move_to_random_block)
 * Allows mob to move towards a random block.
 */
export default interface MinecraftBehaviorMoveToRandomBlock {

  /**
   * @remarks
   * Defines the distance from the mob, in blocks, that the block to
   * move to will be chosen.
   * 
   * Sample Values:
   * Pillager: 512
   *
   *
   */
  block_distance?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Pillager: 6
   *
   * Vindicator: 5
   *
   */
  priority?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Pillager: 0.55
   *
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Defines the distance in blocks the mob has to be from the block
   * for the movement to be finished.
   * 
   * Sample Values:
   * Pillager: 8
   *
   *
   */
  within_radius?: number;

}