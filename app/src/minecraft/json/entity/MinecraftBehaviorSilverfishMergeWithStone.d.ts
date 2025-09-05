// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.silverfish_merge_with_stone
 * 
 * minecraft:behavior.silverfish_merge_with_stone Samples

Silverfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/silverfish.json

"minecraft:behavior.silverfish_merge_with_stone": {
  "priority": 5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Silverfish Merge With Stone Behavior
 * (minecraft:behavior.silverfish_merge_with_stone)
 * Allows the mob to go into stone blocks like Silverfish do.
 */
export default interface MinecraftBehaviorSilverfishMergeWithStone {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Silverfish: 5
   *
   */
  priority?: number;

}