// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_towards_home_restriction
 * 
 * minecraft:behavior.move_towards_home_restriction Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.move_towards_home_restriction": {
  "priority": 9
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:behavior.move_towards_home_restriction": {
  "priority": 5,
  "speed_multiplier": 1
}


Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:behavior.move_towards_home_restriction": {
  "priority": 6,
  "speed_multiplier": 0.6
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move Towards Home Restriction Behavior
 * (minecraft:behavior.move_towards_home_restriction)
 * Allows entities with a `minecraft:home` component to move towards
 * their home position. 
		If `restriction_radius` is set, entities
 * will be able to run this behavior only if outside of it.
 */
export default interface MinecraftBehaviorMoveTowardsHomeRestriction {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Bee: 9
   *
   * Elder Guardian: 5
   *
   *
   * Wandering Trader: 6
   *
   */
  priority: number;

  /**
   * @remarks
   * This multiplier modifies the entity's speed when moving towards its
   * restriction.
   * 
   * Sample Values:
   * Elder Guardian: 1
   *
   *
   * Wandering Trader: 0.6
   *
   */
  speed_multiplier: number;

}