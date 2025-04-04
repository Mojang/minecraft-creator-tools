// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.go_and_give_items_to_noteblock
 * 
 * minecraft:behavior.go_and_give_items_to_noteblock Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.go_and_give_items_to_noteblock": {
  "priority": 3,
  "run_speed": 8,
  "throw_sound": "item_thrown",
  "on_item_throw": [
    {
      "event": "pickup_item_delay",
      "target": "self"
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Go And Give Items To Noteblock Behavior
 * (minecraft:behavior.go_and_give_items_to_noteblock)
 * The entity will attempt to toss the items from its inventory to
 * a nearby recently played noteblock.
 */
export default interface MinecraftBehaviorGoAndGiveItemsToNoteblock {

  /**
   * @remarks
   * Sets the time an entity should continue delivering items to a
   * noteblock after hearing it.
   */
  listen_time: number;

  /**
   * @remarks
   * Event(s) to run when this mob throws items.
   * 
   * Sample Values:
   * Allay: [{"event":"pickup_item_delay","target":"self"}]
   *
   */
  on_item_throw: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * Sets the desired distance to be reached before throwing the
   * items towards the block.
   */
  reach_block_distance: number;

  /**
   * @remarks
   * Sets the entity's speed when running toward the block.
   * 
   * Sample Values:
   * Allay: 8
   *
   */
  run_speed: number;

  /**
   * @remarks
   * Sets the throw force.
   */
  throw_force: number;

  /**
   * @remarks
   * Sound to play when this mob throws an item.
   * 
   * Sample Values:
   * Allay: "item_thrown"
   *
   */
  throw_sound: string;

  /**
   * @remarks
   * Sets the vertical throw multiplier that is applied on top of
   * the throw force in the vertical direction.
   */
  vertical_throw_mul: number;

}