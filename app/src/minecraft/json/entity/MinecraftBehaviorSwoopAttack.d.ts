// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.swoop_attack
 * 
 * minecraft:behavior.swoop_attack Samples

Phantom - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/phantom.json

"minecraft:behavior.swoop_attack": {
  "priority": 2,
  "damage_reach": 0.2,
  "speed_multiplier": 1,
  "delay_range": [
    10,
    20
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Swoop Attack Behavior (minecraft:behavior.swoop_attack)
 * Allows an entity to attack using swoop attack behavior; Ideal for
 * use with flying mobs. The behavior ends if the entity has a
 * horizontal collision or gets hit.
 */
export default interface MinecraftBehaviorSwoopAttack {

  /**
   * @remarks
   * Added to the base size of the entity, to determine the target's
   * maximum allowable distance, when trying to deal attack 
   * damage.
   * 
   * Sample Values:
   * Phantom: 0.2
   *
   */
  damage_reach?: number;

  /**
   * @remarks
   * Minimum and maximum cooldown time-range (in seconds) between each
   * attempted swoop attack.
   * 
   * Sample Values:
   * Phantom: [10,20]
   *
   */
  delay_range?: number[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Phantom: 2
   *
   */
  priority?: number;

  /**
   * @remarks
   * During swoop attack behavior, this determines the multiplier the
   * entity's speed is modified by when moving toward the target.
   * 
   * Sample Values:
   * Phantom: 1
   *
   */
  speed_multiplier?: number;

}