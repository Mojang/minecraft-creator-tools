// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.look_at_entity
 * 
 * minecraft:behavior.look_at_entity Samples

Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.look_at_entity": {
  "priority": 10,
  "look_distance": 8,
  "filters": {
    "test": "is_family",
    "subject": "other",
    "value": "mob"
  }
}


Ravager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ravager.json

"minecraft:behavior.look_at_entity": {
  "priority": 10,
  "look_distance": 8,
  "angle_of_view_horizontal": 45,
  "filters": {
    "test": "is_family",
    "subject": "other",
    "value": "mob"
  }
}


Vex - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vex.json

"minecraft:behavior.look_at_entity": {
  "priority": 9,
  "look_distance": 6,
  "probability": 0.02,
  "filters": {
    "test": "is_family",
    "subject": "other",
    "value": "mob"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Look At Entity Behavior (minecraft:behavior.look_at_entity)
 * Compels an entity to look at a specific entity by rotating the
 * `head` bone pose within a set limit.
 */
export default interface MinecraftBehaviorLookAtEntity {

  /**
   * @remarks
   * The angle in degrees that the mob can see in the Y-axis 
   * (up-down).
   * 
   * Sample Values:
   * Ravager: 45
   *
   */
  angle_of_view_horizontal: number;

  /**
   * @remarks
   * The angle in degrees that the mob can see in the X-axis
   * (left-right).
   */
  angle_of_view_vertical: number;

  /**
   * @remarks
   * Filter to determine the conditions for this mob to look at the
   * entity
   * 
   * Sample Values:
   * Evocation Illager: {"test":"is_family","subject":"other","value":"mob"}
   *
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The distance in blocks from which the entity will look at the
   * nearest entity.
   * 
   * Sample Values:
   * Evocation Illager: 8
   *
   *
   * Vex: 6
   *
   */
  look_distance: number;

  /**
   * @remarks
   * Time range to look at the nearest entity.
   */
  look_time: number[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Evocation Illager: 10
   *
   *
   * Vex: 9
   *
   */
  priority: number;

  /**
   * @remarks
   * The probability of looking at the target. A value of 1.00 is
   * 100%.
   * 
   * Sample Values:
   * Vex: 0.02
   *
   */
  probability: number;

}