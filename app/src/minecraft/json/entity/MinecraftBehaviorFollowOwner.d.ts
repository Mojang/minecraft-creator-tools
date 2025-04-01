// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.follow_owner
 * 
 * minecraft:behavior.follow_owner Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.follow_owner": {
  "priority": 6,
  "speed_multiplier": 8,
  "start_distance": 16,
  "stop_distance": 4,
  "can_teleport": false,
  "ignore_vibration": false
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.follow_owner": {
  "priority": 4,
  "speed_multiplier": 1,
  "start_distance": 10,
  "stop_distance": 2
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:behavior.follow_owner": {
  "priority": 3,
  "speed_multiplier": 1,
  "start_distance": 5,
  "stop_distance": 1
}


Wolf - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wolf.json

"minecraft:behavior.follow_owner": {
  "priority": 6,
  "speed_multiplier": 1,
  "start_distance": 10,
  "stop_distance": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Follow Owner Behavior (minecraft:behavior.follow_owner)
 * Allows a mob to follow the player that owns it.
 * Note: Requires the entity to be marked as an owner through 
 * taming.
 */
export default interface MinecraftBehaviorFollowOwner {

  /**
   * @remarks
   * Defines if the mob will teleport to its owner when too far 
   * away.
   */
  can_teleport: boolean;

  /**
   * @remarks
   * Defines if the mob should disregard following its owner after
   * detecting a recent vibration.
   */
  ignore_vibration: boolean;

  /**
   * @remarks
   * The maximum distance the mob can be from its owner to start
   * following it. Applicable only when "can_teleport" is set to
   * false.
   */
  max_distance: number;

  /**
   * @remarks
   * Defines how far (in blocks) the entity will be from its owner
   * after teleporting. If not specified, it defaults to
   * "stop_distance" + 1, allowing the entity to seamlessly resume
   * navigation.
   */
  post_teleport_distance: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 6
   *
   * Cat: 4
   *
   *
   * Parrot: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Allay: 8
   *
   * Cat: 1
   *
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The minimum distance the mob must be from its owner to start
   * following it.
   * 
   * Sample Values:
   * Allay: 16
   *
   * Cat: 10
   *
   *
   * Parrot: 5
   *
   */
  start_distance: number;

  /**
   * @remarks
   * The distance at which the mob will stop following its owner.
   * 
   * Sample Values:
   * Allay: 4
   *
   * Cat: 2
   *
   *
   * Parrot: 1
   *
   */
  stop_distance: number;

}