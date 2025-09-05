// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.swim_idle
 * 
 * minecraft:behavior.swim_idle Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.swim_idle": {
  "priority": 7,
  "idle_time": 5,
  "success_rate": 0.05
}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:behavior.swim_idle": {
  "priority": 5,
  "idle_time": 5,
  "success_rate": 0.1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Swim Idle Behavior (minecraft:behavior.swim_idle)
 * Allows the entity go idle, if swimming. Entity must be in
 * water.
 */
export default interface MinecraftBehaviorSwimIdle {

  /**
   * @remarks
   * Amount of time (in seconds) to stay idle.
   * 
   * Sample Values:
   * Axolotl: 5
   *
   *
   */
  idle_time?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Axolotl: 7
   *
   * Fish: 5
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Percent chance this entity will go idle, 1.0 = 100%.
   * 
   * Sample Values:
   * Axolotl: 0.05
   *
   * Fish: 0.1
   *
   *
   */
  success_rate?: number;

}