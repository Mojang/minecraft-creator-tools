// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.slime_float
 * 
 * minecraft:behavior.slime_float Samples

Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

"minecraft:behavior.slime_float": {
  "priority": 1,
  "jump_chance_percentage": 0.8,
  "speed_multiplier": 1.2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Slime Float Behavior (minecraft:behavior.slime_float)
 * Allow slimes to float in water / lava.
 */
export default interface MinecraftBehaviorSlimeFloat {

  /**
   * @remarks
   * Percent chance a slime or magma cube has to jump while in water /
   * lava.
   * 
   * Sample Values:
   * Magma Cube: 0.8
   *
   *
   */
  jump_chance_percentage: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Magma Cube: 1
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * Determines the multiplier the entity's speed is modified by
   * when moving through water / lava.
   * 
   * Sample Values:
   * Magma Cube: 1.2
   *
   *
   */
  speed_multiplier: number;

}