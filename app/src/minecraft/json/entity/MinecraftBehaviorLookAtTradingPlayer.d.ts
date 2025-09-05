// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.look_at_trading_player
 * 
 * minecraft:behavior.look_at_trading_player Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.look_at_trading_player": {
  "priority": 2
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.look_at_trading_player": {
  "priority": 7
}


Wandering Trader - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wandering_trader.json

"minecraft:behavior.look_at_trading_player": {
  "priority": 4
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Look At Trading Player Behavior
 * (minecraft:behavior.look_at_trading_player)
 * Compels an entity to look at the player that is currently trading
 * with the entity.
 * Note: Requires the ability to trade in order to work 
 * properly.
 */
export default interface MinecraftBehaviorLookAtTradingPlayer {

  /**
   * @remarks
   * The angle in degrees that the mob can see in the Y-axis 
   * (up-down).
   */
  angle_of_view_horizontal?: number;

  /**
   * @remarks
   * The angle in degrees that the mob can see in the X-axis
   * (left-right).
   */
  angle_of_view_vertical?: number;

  /**
   * @remarks
   * The distance in blocks from which the entity will look at the
   * player this mob is trading with.
   */
  look_distance?: number;

  /**
   * @remarks
   * Time range to look at the player this mob is trading with.
   */
  look_time?: number[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager: 2
   *
   * Villager v2: 7
   *
   * Wandering Trader: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * The probability of looking at the target. A value of 1.00 is
   * 100%.
   */
  probability?: number;

}