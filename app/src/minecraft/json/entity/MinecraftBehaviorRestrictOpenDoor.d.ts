// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.restrict_open_door
 * 
 * minecraft:behavior.restrict_open_door Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.restrict_open_door": {
  "priority": 5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Restrict Open Door Behavior 
 * (minecraft:behavior.restrict_open_door)
 * Allows the mob to stay indoors during night time.
 */
export default interface MinecraftBehaviorRestrictOpenDoor {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager: 5
   *
   */
  priority?: number;

}