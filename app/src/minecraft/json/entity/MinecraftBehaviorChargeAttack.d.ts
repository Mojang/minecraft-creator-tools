// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.charge_attack
 * 
 * minecraft:behavior.charge_attack Samples

Vex - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vex.json

"minecraft:behavior.charge_attack": {
  "priority": 4
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Charge Attack Behavior (minecraft:behavior.charge_attack)
 * Allows this entity to damage a target by using a running 
 * attack.
 */
export default interface MinecraftBehaviorChargeAttack {

  /**
   * @remarks
   * A charge attack cannot start if the entity is farther than this
   * distance to the target.
   */
  max_distance: number;

  /**
   * @remarks
   * A charge attack cannot start if the entity is closer than this
   * distance to the target.
   */
  min_distance: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Vex: 4
   *
   */
  priority: number;

  /**
   * @remarks
   * Modifies the entity's speed when charging toward the target.
   */
  speed_multiplier: number;

  /**
   * @remarks
   * Percent chance this entity will start a charge attack, if not
   * already attacking (1.0 = 100%)
   */
  success_rate: number;

}