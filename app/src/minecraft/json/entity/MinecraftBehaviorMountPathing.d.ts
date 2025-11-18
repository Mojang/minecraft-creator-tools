// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.mount_pathing
 * 
 * minecraft:behavior.mount_pathing Samples

Camel Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel_husk.json

"minecraft:behavior.mount_pathing": {
  "priority": 3,
  "speed_multiplier": 4,
  "target_dist": 0,
  "track_target": true
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.mount_pathing": {
  "priority": 1,
  "speed_multiplier": 1.25,
  "target_dist": 0,
  "track_target": true
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:behavior.mount_pathing": {
  "priority": 5,
  "speed_multiplier": 1.25,
  "target_dist": 0,
  "track_target": true
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:behavior.mount_pathing": {
  "priority": 2,
  "speed_multiplier": 1.5,
  "target_dist": 0,
  "track_target": true
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

"minecraft:behavior.mount_pathing": {
  "priority": 2,
  "speed_multiplier": 1.25,
  "target_dist": 0,
  "track_target": true
}


Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

"minecraft:behavior.mount_pathing": {
  "priority": 5,
  "speed_multiplier": 1.5,
  "target_dist": 0,
  "track_target": true
}


Skeleton Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/skeleton_horse.json

"minecraft:behavior.mount_pathing": {
  "priority": 2,
  "speed_multiplier": 1.5,
  "target_dist": 4,
  "track_target": true
}


Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/1_hello_world/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:behavior.mount_pathing": {
  "priority": 3,
  "speed_multiplier": 1.5,
  "target_dist": 0,
  "track_target": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Mount Pathing Behavior (minecraft:behavior.mount_pathing)
 * Allows the mob to move around on its own while mounted seeking a
 * target to attack. Also will allow an entity to target another entity
 * for an attack.
 */
export default interface MinecraftBehaviorMountPathing {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Camel Husk: 3
   *
   * Cat: 1
   *
   * Cave Spider: 5
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Camel Husk: 4
   *
   * Cat: 1.25
   *
   *
   * Chicken: 1.5
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * The distance at which this mob wants to be away from its 
   * target
   * 
   * Sample Values:
   * Skeleton Horse: 4
   *
   */
  target_dist?: number;

  /**
   * @remarks
   * If true, this mob will chase after the target as long as it's a
   * valid target
   * 
   * Sample Values:
   * Camel Husk: true
   *
   *
   */
  track_target?: boolean;

}