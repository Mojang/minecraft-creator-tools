// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.roll
 * 
 * minecraft:behavior.roll Samples

Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

 * At /minecraft:entity/component_groups/minecraft:panda_baby/minecraft:behavior.roll/: 
"minecraft:behavior.roll": {
  "priority": 12,
  "probability": 0.0016
}

 * At /minecraft:entity/component_groups/minecraft:panda_playful/minecraft:behavior.roll/: 
"minecraft:behavior.roll": {
  "priority": 12,
  "probability": 0.013
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Roll Behavior (minecraft:behavior.roll)
 * This allows the mob to roll forward.
 */
export default interface MinecraftBehaviorRoll {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Panda: 12
   *
   */
  priority: number;

  /**
   * @remarks
   * The probability that the mob will use the goal.
   * 
   * Sample Values:
   * Panda: 0.0016, 0.013
   *
   */
  probability: number;

}