// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.wither_random_attack_pos_goal
 * 
 * minecraft:behavior.wither_random_attack_pos_goal Samples

Wither - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither.json

"minecraft:behavior.wither_random_attack_pos_goal": {
  "priority": 3
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Wither Random Attack Pos Goal Behavior
 * (minecraft:behavior.wither_random_attack_pos_goal)
 * Allows the wither to launch random attacks.
 */
export default interface MinecraftBehaviorWitherRandomAttackPosGoal {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Wither: 3
   *
   */
  priority?: number;

}