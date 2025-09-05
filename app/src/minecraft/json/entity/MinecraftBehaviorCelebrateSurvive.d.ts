// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.celebrate_survive
 * 
 * minecraft:behavior.celebrate_survive Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.celebrate_survive": {
  "priority": 5,
  "fireworks_interval": {
    "range_min": 2,
    "range_max": 7
  },
  "duration": 30,
  "on_celebration_end_event": {
    "event": "minecraft:stop_celebrating",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Celebrate Survive Behavior 
 * (minecraft:behavior.celebrate_survive)
 * Allows this entity to celebrate surviving a raid by shooting
 * fireworks.
 */
export default interface MinecraftBehaviorCelebrateSurvive {

  /**
   * @remarks
   * The duration in seconds that the celebration lasts for.
   * 
   * Sample Values:
   * Villager: 30
   *
   *
   */
  duration?: number;

  /**
   * @remarks
   * Minimum and maximum time between firework (positive, in
   * seconds).
   * 
   * Sample Values:
   * Villager: {"range_min":2,"range_max":7}
   *
   *
   */
  fireworks_interval?: number[];

  /**
   * @remarks
   * The event to trigger when the goal's duration expires.
   * 
   * Sample Values:
   * Villager: {"event":"minecraft:stop_celebrating","target":"self"}
   *
   *
   */
  on_celebration_end_event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager: 5
   *
   *
   */
  priority?: number;

}