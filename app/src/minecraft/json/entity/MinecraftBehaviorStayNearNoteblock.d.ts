// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.stay_near_noteblock
 * 
 * minecraft:behavior.stay_near_noteblock Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.stay_near_noteblock": {
  "priority": 5,
  "speed": 8,
  "start_distance": 16,
  "stop_distance": 4
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Stay Near Noteblock Behavior 
 * (minecraft:behavior.stay_near_noteblock)
 * The entity will attempt to toss the items from its inventory to
 * a nearby recently played noteblock.
 */
export default interface MinecraftBehaviorStayNearNoteblock {

  /**
   * @remarks
   * Sets the time an entity should stay near a noteblock after hearing
   * it.
   */
  listen_time: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 5
   *
   */
  priority: number;

  /**
   * @remarks
   * Sets the entity's speed when moving toward the block.
   * 
   * Sample Values:
   * Allay: 8
   *
   */
  speed: number;

  /**
   * @remarks
   * Sets the distance the entity needs to be away from the block to
   * attempt to start the goal.
   * 
   * Sample Values:
   * Allay: 16
   *
   */
  start_distance: number;

  /**
   * @remarks
   * Sets the distance from the block the entity will attempt to
   * reach.
   * 
   * Sample Values:
   * Allay: 4
   *
   */
  stop_distance: number;

}