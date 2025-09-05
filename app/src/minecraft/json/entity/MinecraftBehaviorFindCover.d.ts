// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.find_cover
 * 
 * minecraft:behavior.find_cover Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:fox_thunderstorm/minecraft:behavior.find_cover/: 
"minecraft:behavior.find_cover": {
  "priority": 0,
  "speed_multiplier": 1,
  "cooldown_time": 0
}

 * At /minecraft:entity/component_groups/minecraft:fox_day/minecraft:behavior.find_cover/: 
"minecraft:behavior.find_cover": {
  "priority": 9,
  "speed_multiplier": 1,
  "cooldown_time": 5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Find Cover Behavior (minecraft:behavior.find_cover)
 * Allows the mob to seek shade.
 */
export default interface MinecraftBehaviorFindCover {

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   * 
   * Sample Values:
   * Fox: 5
   *
   */
  cooldown_time?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Fox: 9
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Fox: 1
   *
   */
  speed_multiplier?: number;

}