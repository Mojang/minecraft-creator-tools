// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.random_swim
 * 
 * minecraft:behavior.random_swim Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.random_swim": {
  "priority": 8,
  "interval": 0,
  "xz_dist": 30,
  "y_dist": 15
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.random_swim": {
  "priority": 5,
  "interval": 0,
  "xz_dist": 20
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:behavior.random_swim": {
  "priority": 7,
  "speed_multiplier": 0.5,
  "avoid_surface": false
}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:behavior.random_swim": {
  "priority": 3,
  "speed_multiplier": 1,
  "xz_dist": 16,
  "y_dist": 4,
  "interval": 0
}


Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/guardian.json

"minecraft:behavior.random_swim": {
  "priority": 7,
  "speed_multiplier": 1,
  "interval": 80,
  "avoid_surface": false
}


Nautilus - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/nautilus.json

"minecraft:behavior.random_swim": {
  "priority": 6,
  "speed_multiplier": 1.5,
  "xz_dist": 16,
  "y_dist": 4,
  "interval": 0
}


Salmon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/salmon.json

"minecraft:behavior.random_swim": {
  "speed_multiplier": 1,
  "priority": 3,
  "xz_dist": 16,
  "y_dist": 4,
  "interval": 0
}


Tadpole - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/tadpole.json

"minecraft:behavior.random_swim": {
  "priority": 2,
  "interval": 100
}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

"minecraft:behavior.random_swim": {
  "priority": 7,
  "interval": 0,
  "xz_dist": 30,
  "y_dist": 15
}


Zombie Nautilus - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_nautilus.json

"minecraft:behavior.random_swim": {
  "priority": 4,
  "speed_multiplier": 1.5,
  "xz_dist": 16,
  "y_dist": 4,
  "interval": 0
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Random Swim Behavior (minecraft:behavior.random_swim)
 * Allows an entity to randomly move through water.
 */
export default interface MinecraftBehaviorRandomSwim {

  /**
   * @remarks
   * If true, the mob will avoid surface water blocks by swimming below
   * them
   */
  avoid_surface?: boolean;

  /**
   * @remarks
   * A random value to determine when to randomly move somewhere. This
   * has a 1/interval chance to choose this goal
   * 
   * Sample Values:
   * Guardian: 80
   *
   * Tadpole: 100
   *
   */
  interval?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Axolotl: 8
   *
   * Dolphin: 5
   *
   * Elder Guardian: 7
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Elder Guardian: 0.5
   *
   * Fish: 1
   *
   *
   * Nautilus: 1.5
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Distance in blocks on ground that the mob will look for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Axolotl: 30
   *
   * Dolphin: 20
   *
   * Fish: 16
   *
   */
  xz_dist?: number;

  /**
   * @remarks
   * Distance in blocks that the mob will look up or down for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Axolotl: 15
   *
   * Fish: 4
   *
   *
   *
   */
  y_dist?: number;

}