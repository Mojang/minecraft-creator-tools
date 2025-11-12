// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.find_mount
 * 
 * minecraft:behavior.find_mount Samples

Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

"minecraft:behavior.find_mount": {
  "priority": 0,
  "within_radius": 16
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:behavior.find_mount": {
  "priority": 4,
  "within_radius": 16,
  "avoid_water": true,
  "start_delay": 100,
  "target_needed": false,
  "mount_distance": 2
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.find_mount": {
  "priority": 1,
  "within_radius": 16,
  "start_delay": 15,
  "max_failed_attempts": 20
}


Zombie Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_villager.json

"minecraft:behavior.find_mount": {
  "priority": 1,
  "within_radius": 16
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Find Mount Behavior (minecraft:behavior.find_mount)
 * Allows the mob to look around for another mob to ride atop 
 * it.
 */
export default interface MinecraftBehaviorFindMount {

  /**
   * @remarks
   * If true, the mob will not go into water blocks when going towards a
   * mount
   * 
   * Sample Values:
   * Parrot: true
   *
   */
  avoid_water?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Piglin: 20
   *
   *
   */
  max_failed_attempts?: number;

  /**
   * @remarks
   * This is the distance the mob needs to be, in blocks, from the
   * desired mount to mount it. If the value is below 0, the mob will
   * use its default attack distance
   * 
   * Sample Values:
   * Parrot: 2
   *
   */
  mount_distance?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Parrot: 4
   *
   * Piglin: 1
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Time the mob will wait before starting to move towards the 
   * mount
   * 
   * Sample Values:
   * Parrot: 100
   *
   * Piglin: 15
   *
   *
   */
  start_delay?: number;

  /**
   * @remarks
   * If true, the mob will only look for a mount if it has a 
   * target
   */
  target_needed?: boolean;

  /**
   * @remarks
   * Distance in blocks within which the mob will look for a 
   * mount
   * 
   * Sample Values:
   * Husk: 16
   *
   *
   */
  within_radius?: number;

}