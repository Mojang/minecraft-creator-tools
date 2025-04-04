// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.skeleton_horse_trap
 * 
 * minecraft:behavior.skeleton_horse_trap Samples

Skeleton Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/skeleton_horse.json

"minecraft:behavior.skeleton_horse_trap": {
  "within_radius": 10,
  "duration": 900,
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Skeleton Horse Trap Behavior 
 * (minecraft:behavior.skeleton_horse_trap)
 * Allows Equine mobs to be Horse Traps and be triggered like them,
 * spawning a lightning bolt and a bunch of horses when a player is
 * nearby. Can only be used by Horses, Mules, Donkeys and Skeleton
 * Horses.
 */
export default interface MinecraftBehaviorSkeletonHorseTrap {

  /**
   * @remarks
   * Amount of time in seconds the trap exists. After this amount of
   * time is elapsed, the trap is removed from the world if it
   * hasn't been activated
   * 
   * Sample Values:
   * Skeleton Horse: 900
   *
   */
  duration: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Skeleton Horse: 2
   *
   */
  priority: number;

  /**
   * @remarks
   * Distance in blocks that the player has to be within to trigger the
   * horse trap
   * 
   * Sample Values:
   * Skeleton Horse: 10
   *
   */
  within_radius: number;

}