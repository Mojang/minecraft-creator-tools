// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.squid_dive
 * 
 * minecraft:behavior.squid_dive Samples

Glow Squid - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/glow_squid.json

"minecraft:behavior.squid_dive": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Squid Dive Behavior (minecraft:behavior.squid_dive)
 * Allows the squid to dive down in water.
 */
export default interface MinecraftBehaviorSquidDive {

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
  priority: number;

}