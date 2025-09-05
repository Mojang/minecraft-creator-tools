// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.silverfish_wake_up_friends
 * 
 * minecraft:behavior.silverfish_wake_up_friends Samples

Silverfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/silverfish.json

"minecraft:behavior.silverfish_wake_up_friends": {
  "priority": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Silverfish Wake Up Friends Behavior
 * (minecraft:behavior.silverfish_wake_up_friends)
 * Allows the mob to alert mobs in nearby blocks to come out.
 */
export default interface MinecraftBehaviorSilverfishWakeUpFriends {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Silverfish: 1
   *
   */
  priority?: number;

}