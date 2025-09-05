// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.leap_at_target
 * 
 * minecraft:behavior.leap_at_target Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.leap_at_target": {
  "priority": 3,
  "target_dist": 0.3
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_hostile/minecraft:behavior.leap_at_target/: 
"minecraft:behavior.leap_at_target": {
  "priority": 4,
  "yd": 0.4,
  "must_be_on_ground": false
}


Wolf - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wolf.json

"minecraft:behavior.leap_at_target": {
  "priority": 4,
  "yd": 0.4
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Leap At Target Behavior (minecraft:behavior.leap_at_target)
 * Allows monsters to jump at and attack their target. Can only be
 * used by hostile mobs.
 */
export default interface MinecraftBehaviorLeapAtTarget {

  /**
   * @remarks
   * If true, the mob will only jump at its target if its on the
   * ground. Setting it to false will allow it to jump even if its
   * already in the air
   */
  must_be_on_ground?: boolean;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Cat: 3
   *
   * Cave Spider: 4
   *
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
   * 
   * Sample Values:
   * Cat: 0.3
   *
   *
   */
  target_dist?: number;

  /**
   * @remarks
   * The height in blocks the mob jumps when leaping at its 
   * target
   * 
   * Sample Values:
   * Cave Spider: 0.4
   *
   */
  yd?: number;

}