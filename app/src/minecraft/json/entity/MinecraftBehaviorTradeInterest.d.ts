// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.trade_interest
 * 
 * minecraft:behavior.trade_interest Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/trade_components/minecraft:behavior.trade_interest/: 
"minecraft:behavior.trade_interest": {}

 * At /minecraft:entity/component_groups/farmer/minecraft:behavior.trade_interest/: 
"minecraft:behavior.trade_interest": {
  "priority": 5,
  "within_radius": 6,
  "interest_time": 45,
  "remove_item_time": 1,
  "carried_item_switch_time": 2,
  "cooldown": 2
}


Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:behavior.trade_interest": {
  "priority": 3,
  "within_radius": 6,
  "interest_time": 45,
  "remove_item_time": 1,
  "carried_item_switch_time": 2,
  "cooldown": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Trade Interest Behavior (minecraft:behavior.trade_interest)
 * Allows the mob to look at a player that is holding a tradable 
 * item.
 */
export default interface MinecraftBehaviorTradeInterest {

  /**
   * @remarks
   * The max time in seconds that the trader will hold an item before
   * attempting to switch for a different item that takes the same
   * trade
   * 
   * Sample Values:
   * Villager v2: 2
   *
   */
  carried_item_switch_time: number;

  /**
   * @remarks
   * The time in seconds before the trader can use this goal 
   * again
   * 
   * Sample Values:
   * Villager v2: 2
   *
   */
  cooldown: number;

  /**
   * @remarks
   * The max time in seconds that the trader will be interested with
   * showing its trade items
   * 
   * Sample Values:
   * Villager v2: 45
   *
   */
  interest_time: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 5
   *
   * Wandering Trader: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * The max time in seconds that the trader will wait when you no
   * longer have items to trade
   * 
   * Sample Values:
   * Villager v2: 1
   *
   */
  remove_item_time: number;

  /**
   * @remarks
   * Distance in blocks this mob can be interested by a player holding an
   * item they like
   * 
   * Sample Values:
   * Villager v2: 6
   *
   */
  within_radius: number;

}