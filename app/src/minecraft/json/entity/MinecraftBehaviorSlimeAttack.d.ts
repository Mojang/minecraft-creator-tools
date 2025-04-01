// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.slime_attack
 * 
 * minecraft:behavior.slime_attack Samples

Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

"minecraft:behavior.slime_attack": {
  "priority": 3
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Slime Attack Behavior (minecraft:behavior.slime_attack)
 * Causes the entity to grow tired every once in a while, while
 * attacking.
 * Note: In order to attack, the entity must have a
 * `runtime_identifier` set to `minecraft:slime` and a `variant`
 * component with a value greater than 1. Otherwise it will still
 * path towards a target, but it will not cause damage.
 */
export default interface MinecraftBehaviorSlimeAttack {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Magma Cube: 3
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * Allows the actor to be set to persist upon targeting a 
   * player
   */
  set_persistent: boolean;

  /**
   * @remarks
   * During attack behavior, this multiplier modifies the entity's speed
   * when moving toward the target.
   */
  speed_multiplier: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   */
  x_max_rotation: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate while trying to look at the target.
   */
  y_max_rotation: number;

}