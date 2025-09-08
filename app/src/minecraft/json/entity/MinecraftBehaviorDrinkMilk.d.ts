// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.drink_milk
 * 
 * minecraft:behavior.drink_milk Samples

Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:behavior.drink_milk": {
  "priority": 5,
  "filters": {
    "all_of": [
      {
        "test": "is_daytime",
        "value": true
      },
      {
        "test": "is_visible",
        "subject": "self",
        "value": false
      },
      {
        "test": "is_avoiding_mobs",
        "subject": "self",
        "value": false
      }
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Drink Milk Behavior (minecraft:behavior.drink_milk)
 * Allows the mob to drink milk based on specified environment 
 * conditions.
 */
export default interface MinecraftBehaviorDrinkMilk {

  /**
   * @remarks
   * Time (in seconds) that the goal is on cooldown before it can be
   * used again.
   */
  cooldown_seconds?: number;

  /**
   * @remarks
   * Conditions that need to be met for the behavior to start.
   * 
   * Sample Values:
   * Wandering Trader: {"all_of":[{"test":"is_daytime","value":true},{"test":"is_visible","subject":"self","value":false},{"test":"is_avoiding_mobs","subject":"self","value":false}]}
   *
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Wandering Trader: 5
   *
   */
  priority?: number;

}