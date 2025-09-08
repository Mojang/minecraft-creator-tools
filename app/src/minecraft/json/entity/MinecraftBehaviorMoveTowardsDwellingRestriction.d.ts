// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.move_towards_dwelling_restriction
 * 
 * minecraft:behavior.move_towards_dwelling_restriction Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.move_towards_dwelling_restriction": {
  "priority": 7
}


Iron Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/iron_golem.json

"minecraft:behavior.move_towards_dwelling_restriction": {
  "priority": 4,
  "speed_multiplier": 1
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.move_towards_dwelling_restriction": {
  "priority": 11,
  "speed_multiplier": 0.6
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Move Towards Dwelling Restriction Behavior
 * (minecraft:behavior.move_towards_dwelling_restriction)
 * Allows entities with the "minecraft:dweller" component to move
 * toward their Village area that the entity should be restricted 
 * to.
 */
export default interface MinecraftBehaviorMoveTowardsDwellingRestriction {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Cat: 7
   *
   * Iron Golem: 4
   *
   * Villager v2: 11
   *
   */
  priority?: number;

  /**
   * @remarks
   * This multiplier modifies the entity's speed when moving towards its
   * restriction.
   * 
   * Sample Values:
   * Iron Golem: 1
   *
   * Villager v2: 0.6
   *
   */
  speed_multiplier?: number;

}