// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.share_items
 * 
 * minecraft:behavior.share_items Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.share_items": {
  "priority": 8,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 0.5,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "villager"
      }
    }
  ]
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.share_items": {
  "priority": 10,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 0.5,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "villager"
      }
    }
  ]
}


Beachager - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/entities/beachager.behavior.json

"minecraft:behavior.share_items": {
  "priority": 9,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 0.5,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "villager"
      }
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Share Items Behavior (minecraft:behavior.share_items)
 * Allows the mob to give items it has to others.
 */
export default interface MinecraftBehaviorShareItems {

  /**
   * @remarks
   * List of entities this mob will share items with
   * 
   * Sample Values:
   * Villager: [{"filters":{"test":"is_family","subject":"other","value":"villager"}}]
   *
   */
  entity_types?: MinecraftBehaviorShareItemsEntityTypes[];

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   */
  goal_radius?: number;

  /**
   * @remarks
   * Maximum distance in blocks this mob will look for entities to
   * share items with
   */
  max_dist?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   */
  speed_multiplier?: number;

}


/**
 * List of entities this mob will share items with.
 */
export interface MinecraftBehaviorShareItemsEntityTypes {

  /**
   * @remarks
   * The amount of time in seconds that the mob has to wait before
   * selecting a target of the same type again
   */
  cooldown?: number;

  /**
   * @remarks
   * Conditions that make this entry in the list valid
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum distance this mob can be away to be a valid choice
   */
  max_dist?: number;

  /**
   * @remarks
   * If true, the mob has to be visible to be a valid choice
   */
  must_see?: boolean;

  /**
   * @remarks
   * Determines the amount of time in seconds that this mob will look
   * for a target before forgetting about it and looking for a new
   * one when the target isn't visible any more
   */
  must_see_forget_duration?: number;

  /**
   * @remarks
   * If true, the mob will stop being targeted if it stops meeting any
   * conditions.
   */
  reevaluate_description?: boolean;

  /**
   * @remarks
   * Multiplier for the running speed. A value of 1.0 means the speed
   * is unchanged
   */
  sprint_speed_multiplier?: number;

  /**
   * @remarks
   * Multiplier for the walking speed. A value of 1.0 means the speed
   * is unchanged
   */
  walk_speed_multiplier?: number;

}