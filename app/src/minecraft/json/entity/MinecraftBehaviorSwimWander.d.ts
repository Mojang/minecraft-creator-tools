// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.swim_wander
 * 
 * minecraft:behavior.swim_wander Samples

Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:behavior.swim_wander": {
  "priority": 4,
  "interval": 0.1,
  "look_ahead": 2,
  "speed_multiplier": 1,
  "wander_time": 5
}


Pufferfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pufferfish.json

"minecraft:behavior.swim_wander": {
  "priority": 5,
  "interval": 1,
  "look_ahead": 2,
  "speed_multiplier": 1,
  "wander_time": 5
}


Salmon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/salmon.json

"minecraft:behavior.swim_wander": {
  "priority": 4,
  "interval": 0.0166,
  "look_ahead": 5,
  "speed_multiplier": 0.014,
  "wander_time": 5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Swim Wander Behavior (minecraft:behavior.swim_wander)
 * Allows the entity to wander around while swimming, when not
 * path-finding.
 */
export default interface MinecraftBehaviorSwimWander {

  /**
   * @remarks
   * Percent chance to start wandering, when not path-finding. 1 =
   * 100%
   * 
   * Sample Values:
   * Fish: 0.1
   *
   * Pufferfish: 1
   *
   * Salmon: 0.0166
   *
   */
  interval: number;

  /**
   * @remarks
   * Distance to look ahead for obstacle avoidance, while 
   * wandering.
   * 
   * Sample Values:
   * Fish: 2
   *
   *
   * Salmon: 5
   *
   */
  look_ahead: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Fish: 4
   *
   * Pufferfish: 5
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * This multiplier modifies the entity's speed when wandering.
   * 
   * Sample Values:
   * Fish: 1
   *
   *
   * Salmon: 0.014
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * Amount of time (in seconds) to wander after wandering behavior was
   * successfully started.
   * 
   * Sample Values:
   * Fish: 5
   *
   *
   */
  wander_time: number;

}