// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.enderman_take_block
 * 
 * minecraft:behavior.enderman_take_block Samples

Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:behavior.enderman_take_block": {
  "priority": 11
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Enderman Take Block Behavior 
 * (minecraft:behavior.enderman_take_block)
 * Allows the enderman to take a block and carry it around.
 */
export default interface MinecraftBehaviorEndermanTakeBlock {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Enderman: 11
   *
   */
  priority: number;

}