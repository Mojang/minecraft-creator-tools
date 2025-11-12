// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.stalk_and_pounce_on_target
 * 
 * minecraft:behavior.stalk_and_pounce_on_target Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.stalk_and_pounce_on_target": {
  "priority": 7,
  "stalk_speed": 1.2,
  "max_stalk_dist": 12,
  "leap_height": 0.9,
  "leap_dist": 0.8,
  "pounce_max_dist": 5,
  "interest_time": 2,
  "stuck_time": 2,
  "strike_dist": 2,
  "stuck_blocks": {
    "test": "is_block",
    "subject": "block",
    "operator": "==",
    "value": "snow_layer"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Stalk And Pounce On Target Behavior
 * (minecraft:behavior.stalk_and_pounce_on_target)
 * Allows a mob to stalk a target, then once within range pounce onto
 * a target, on success the target will be attacked dealing damage
 * defined by the attack component. On failure, the mob will risk
 * getting stuck.
 */
export default interface MinecraftBehaviorStalkAndPounceOnTarget {

  /**
   * @remarks
   * The amount of time the mob will be interested before pouncing. This
   * happens when the mob is within range of pouncing
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  interest_time?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: 0.8
   *
   */
  leap_dist?: number;

  /**
   * @remarks
   * The distance in blocks the mob jumps in the direction of its
   * target
   */
  leap_distance?: number;

  /**
   * @remarks
   * The height in blocks the mob jumps when leaping at its 
   * target
   * 
   * Sample Values:
   * Fox: 0.9
   *
   */
  leap_height?: number;

  /**
   * @remarks
   * The maximum distance away a target can be before the mob gives up
   * on stalking
   * 
   * Sample Values:
   * Fox: 12
   *
   */
  max_stalk_dist?: number;

  /**
   * @remarks
   * The maximum distance away from the target in blocks to begin
   * pouncing at the target
   * 
   * Sample Values:
   * Fox: 5
   *
   */
  pounce_max_dist?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Fox: 7
   *
   */
  priority?: number;

  /**
   * @remarks
   * Allows the actor to be set to persist upon targeting a 
   * player
   */
  set_persistent?: boolean;

  /**
   * @remarks
   * The movement speed in which you stalk your target
   * 
   * Sample Values:
   * Fox: 1.2
   *
   */
  stalk_speed?: number;

  /**
   * @remarks
   * The max distance away from the target when landing from the
   * pounce that will still result in damaging the target
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  strike_dist?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: {"test":"is_block","subject":"block","operator":"==","value":"snow_layer"}
   *
   */
  stuck_blocks?: MinecraftBehaviorStalkAndPounceOnTargetStuckBlocks;

  /**
   * @remarks
   * The amount of time the mob will be stuck if they fail and land on
   * a block they can be stuck on
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  stuck_time?: number;

}


/**
 * Stuck blocks (stuck_blocks)
 */
export interface MinecraftBehaviorStalkAndPounceOnTargetStuckBlocks {

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: "=="
   *
   */
  operator?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: "block"
   *
   */
  subject?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: "is_block"
   *
   */
  test?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: "snow_layer"
   *
   */
  value?: string;

}