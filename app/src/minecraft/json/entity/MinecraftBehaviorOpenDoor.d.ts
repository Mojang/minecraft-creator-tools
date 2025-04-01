// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.open_door
 * 
 * minecraft:behavior.open_door Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.open_door": {
  "priority": 6,
  "close_door_after": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Open Door Behavior (minecraft:behavior.open_door)
 * Allows the mob to open doors. Requires the mob to be able to
 * path through doors, otherwise the mob won't even want to try
 * opening them.
 */
export default interface MinecraftBehaviorOpenDoor {

  /**
   * @remarks
   * If true, the mob will close the door after opening it and going
   * through it
   * 
   * Sample Values:
   * Villager: true
   *
   */
  close_door_after: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager: 6
   *
   */
  priority: number;

}