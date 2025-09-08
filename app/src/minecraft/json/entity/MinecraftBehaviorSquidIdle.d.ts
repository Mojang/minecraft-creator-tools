// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.squid_idle
 * 
 * minecraft:behavior.squid_idle Samples

Glow Squid - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/glow_squid.json

"minecraft:behavior.squid_idle": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Squid Idle Behavior (minecraft:behavior.squid_idle)
 * Allows the squid to swim in place idly.
 */
export default interface MinecraftBehaviorSquidIdle {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Glow Squid: 2
   *
   *
   */
  priority?: number;

}