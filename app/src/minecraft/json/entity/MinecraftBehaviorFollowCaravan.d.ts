// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.follow_caravan
 * 
 * minecraft:behavior.follow_caravan Samples

Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:behavior.follow_caravan": {
  "priority": 3,
  "speed_multiplier": 2.1,
  "entity_count": 10,
  "entity_types": {
    "filters": {
      "test": "is_family",
      "subject": "other",
      "value": "llama"
    }
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Follow Caravan Behavior (minecraft:behavior.follow_caravan)
 * Allows the mob to follow mobs that are in a caravan.
 */
export default interface MinecraftBehaviorFollowCaravan {

  /**
   * @remarks
   * Number of entities that can be in the caravan
   * 
   * Sample Values:
   * Llama: 10
   *
   *
   */
  entity_count?: number;

  /**
   * @remarks
   * List of entity types that this mob can follow in a caravan
   * 
   * Sample Values:
   * Llama: {"filters":{"test":"is_family","subject":"other","value":"llama"}}
   *
   *
   */
  entity_types?: MinecraftBehaviorFollowCaravanEntityTypes[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Llama: 3
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Llama: 2.1
   *
   *
   */
  speed_multiplier?: number;

}


/**
 * List of entity types that this mob can follow in a caravan.
 */
export interface MinecraftBehaviorFollowCaravanEntityTypes {

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