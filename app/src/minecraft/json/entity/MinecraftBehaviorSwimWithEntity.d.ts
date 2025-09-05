// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.swim_with_entity
 * 
 * minecraft:behavior.swim_with_entity Samples

Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.swim_with_entity": {
  "priority": 4,
  "success_rate": 0.1,
  "chance_to_stop": 0.0333,
  "state_check_interval": 0.5,
  "catch_up_threshold": 12,
  "match_direction_threshold": 2,
  "catch_up_multiplier": 2.5,
  "speed_multiplier": 1.5,
  "search_range": 20,
  "stop_distance": 5,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      }
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Swim With Entity Behavior 
 * (minecraft:behavior.swim_with_entity)
 * Allows the entity follow another entity. Both entities must be
 * swimming [ie, in water].
 */
export default interface MinecraftBehaviorSwimWithEntity {

  /**
   * @remarks
   * The multiplier this entity's speed is modified by when matching
   * another entity's direction.
   * 
   * Sample Values:
   * Dolphin: 2.5
   *
   */
  catch_up_multiplier?: number;

  /**
   * @remarks
   * Distance, from the entity being followed, at which this entity will
   * speed up to reach that entity.
   * 
   * Sample Values:
   * Dolphin: 12
   *
   */
  catch_up_threshold?: number;

  /**
   * @remarks
   * Percent chance to stop following the current entity, if they're
   * riding another entity or they're not swimming. 1.0 = 100%
   * 
   * Sample Values:
   * Dolphin: 0.0333
   *
   */
  chance_to_stop?: number;

  /**
   * @remarks
   * Filters which types of entities are valid to follow.
   * 
   * Sample Values:
   * Dolphin: [{"filters":{"test":"is_family","subject":"other","value":"player"}}]
   *
   */
  entity_types?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Distance, from the entity being followed, at which this entity will
   * try to match that entity's direction
   * 
   * Sample Values:
   * Dolphin: 2
   *
   */
  match_direction_threshold?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Dolphin: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * Radius around this entity to search for another entity to
   * follow.
   * 
   * Sample Values:
   * Dolphin: 20
   *
   */
  search_range?: number;

  /**
   * @remarks
   * The multiplier this entity's speed is modified by when trying to
   * catch up to the entity being followed.
   * 
   * Sample Values:
   * Dolphin: 1.5
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Time (in seconds) between checks to determine if this entity should
   * catch up to the entity being followed or match the direction of
   * the entity being followed.
   * 
   * Sample Values:
   * Dolphin: 0.5
   *
   */
  state_check_interval?: number;

  /**
   * @remarks
   * Distance, from the entity being followed, at which this entity will
   * stop following that entity.
   * 
   * Sample Values:
   * Dolphin: 5
   *
   */
  stop_distance?: number;

  /**
   * @remarks
   * Percent chance to start following another entity, if not already
   * doing so. 1.0 = 100%
   * 
   * Sample Values:
   * Dolphin: 0.1
   *
   */
  success_rate?: number;

}