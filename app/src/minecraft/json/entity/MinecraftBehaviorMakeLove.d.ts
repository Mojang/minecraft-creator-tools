// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.make_love
 * 
 * minecraft:behavior.make_love Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.make_love": {
  "priority": 6
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.make_love": {
  "priority": 5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Make Love Behavior (minecraft:behavior.make_love)
 * Allows the villager to look for a mate to spawn other villagers 
 * with.
 */
export default interface MinecraftBehaviorMakeLove {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager: 6
   *
   * Villager v2: 5
   *
   *
   */
  priority?: number;

}