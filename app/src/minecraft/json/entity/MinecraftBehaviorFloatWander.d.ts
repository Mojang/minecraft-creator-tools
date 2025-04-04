// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.float_wander
 * 
 * minecraft:behavior.float_wander Samples

Bat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bat.json

"minecraft:behavior.float_wander": {
  "xz_dist": 10,
  "y_dist": 7,
  "y_offset": -2,
  "random_reselect": true,
  "float_duration": [
    0.1,
    0.35
  ]
}


Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ghast.json

"minecraft:behavior.float_wander": {
  "priority": 2,
  "must_reach": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Float Wander Behavior (minecraft:behavior.float_wander)
 * Allows the mob to float around like the Ghast.
 */
export default interface MinecraftBehaviorFloatWander {

  /**
   * @remarks
   * If true, the mob will have an additional buffer zone around it
   * to avoid collisions with blocks when picking a position to
   * wander to.
   */
  additional_collision_buffer: boolean;

  /**
   * @remarks
   * If true allows the mob to navigate through liquids on its way to
   * the target position.
   */
  allow_navigating_through_liquids: boolean;

  /**
   * @remarks
   * Range of time in seconds the mob will float around before landing
   * and choosing to do something else
   * 
   * Sample Values:
   * Bat: [0.1,0.35]
   *
   */
  float_duration: number[];

  /**
   * @remarks
   * If true, the MoveControl flag will be added to the behavior which
   * means that it can no longer be active at the same time as other
   * behaviors with MoveControl.
   */
  float_wander_has_move_control: boolean;

  /**
   * @remarks
   * If true, the point has to be reachable to be a valid target
   * 
   * Sample Values:
   * Ghast: true
   *
   */
  must_reach: boolean;

  /**
   * @remarks
   * If true, will prioritize finding random positions in the
   * vicinity of surfaces, i.e. blocks that are not Air or 
   * Liquid.
   */
  navigate_around_surface: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ghast: 2
   *
   */
  priority: number;

  /**
   * @remarks
   * If true, the mob will randomly pick a new point while moving to
   * the previously selected one
   * 
   * Sample Values:
   * Bat: true
   *
   */
  random_reselect: boolean;

  /**
   * @remarks
   * The horizontal distance in blocks that the goal will check for a
   * surface from a candidate position. Only valid when
   * `navigate_around_surface` is true.
   */
  surface_xz_dist: number;

  /**
   * @remarks
   * The vertical distance in blocks that the goal will check for a
   * surface from a candidate position. Only valid when
   * `navigate_around_surface` is true.
   */
  surface_y_dist: number;

  /**
   * @remarks
   * If true, the mob will respect home position restrictions when
   * choosing new target positions. If false, it will choose target
   * position without considering home restrictions
   */
  use_home_position_restriction: boolean;

  /**
   * @remarks
   * Distance in blocks on ground that the mob will look for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Bat: 10
   *
   */
  xz_dist: number;

  /**
   * @remarks
   * Distance in blocks that the mob will look up or down for a new
   * spot to move to. Must be at least 1
   * 
   * Sample Values:
   * Bat: 7
   *
   */
  y_dist: number;

  /**
   * @remarks
   * Height in blocks to add to the selected target position
   * 
   * Sample Values:
   * Bat: -2
   *
   */
  y_offset: number;

}