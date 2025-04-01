// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.hide
 * 
 * minecraft:behavior.hide Samples

Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.hide": {
  "priority": 0,
  "speed_multiplier": 0.8,
  "poi_type": "bed",
  "duration": 30
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Hide Behavior (minecraft:behavior.hide)
 * Allows a mob with the hide component to attempt to move to -
 * and hide at - an owned or nearby POI.
 * Note: Requires a point of interest to be set in order to work
 * properly.
 */
export default interface MinecraftBehaviorHide {

  /**
   * @remarks
   * Amount of time in seconds that the mob reacts.
   * 
   * Sample Values:
   * Villager V2: 30
   *
   */
  duration: number;

  /**
   * @remarks
   * Defines what POI type to hide at.
   * 
   * Sample Values:
   * Villager V2: "bed"
   *
   */
  poi_type: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Villager V2: 0.8
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The cooldown time in seconds before the goal can be reused after a
   * internal failure or timeout condition.
   */
  timeout_cooldown: number;

}