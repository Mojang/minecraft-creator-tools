// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragonholdingpattern
 * 
 * minecraft:behavior.dragonholdingpattern Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragonholdingpattern": {
  "priority": 3
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragonholdingpattern Behavior
 * (minecraft:behavior.dragonholdingpattern)
 * Allows the Dragon to fly around in a circle around the center
 * podium.
 */
export default interface MinecraftBehaviorDragonholdingpattern {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ender Dragon: 3
   *
   */
  priority?: number;

}