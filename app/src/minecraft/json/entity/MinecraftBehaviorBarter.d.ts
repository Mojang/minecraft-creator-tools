// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.barter
 * 
 * minecraft:behavior.barter Samples

Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.barter": {
  "priority": 3
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Barter Behavior (minecraft:behavior.barter)
 * Enables the mob to barter for items that have been configured as
 * barter currency. Must be used in combination with the barter
 * component.
 * Note: Requires the `minecraft:barter` component and
 * `barter_table` loot table in order to work properly.
 */
export default interface MinecraftBehaviorBarter {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Piglin: 3
   *
   */
  priority: number;

}