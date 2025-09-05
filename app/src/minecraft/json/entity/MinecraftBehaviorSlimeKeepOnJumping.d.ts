// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.slime_keep_on_jumping
 * 
 * minecraft:behavior.slime_keep_on_jumping Samples

Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

"minecraft:behavior.slime_keep_on_jumping": {
  "priority": 5,
  "speed_multiplier": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Slime Keep On Jumping Behavior
 * (minecraft:behavior.slime_keep_on_jumping)
 * Allows the entity to continuously jump around like a slime.
 */
export default interface MinecraftBehaviorSlimeKeepOnJumping {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Magma Cube: 5
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Determines the multiplier this entity's speed is modified by
   * when jumping around.
   * 
   * Sample Values:
   * Magma Cube: 1
   *
   *
   */
  speed_multiplier?: number;

}