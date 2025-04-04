// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:trade_table
 * 
 * minecraft:trade_table Samples

Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

 * At /minecraft:entity/component_groups/farmer/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.farmer",
  "table": "trading/farmer_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/fisherman/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.fisherman",
  "table": "trading/fisherman_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/shepherd/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.shepherd",
  "table": "trading/shepherd_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/fletcher/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.fletcher",
  "table": "trading/fletcher_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/librarian/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.librarian",
  "table": "trading/librarian_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/cartographer/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.cartographer",
  "table": "trading/cartographer_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/cleric/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.cleric",
  "table": "trading/cleric_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/armorer/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.armor",
  "table": "trading/armorer_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/weaponsmith/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.weapon",
  "table": "trading/weapon_smith_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/toolsmith/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.tool",
  "table": "trading/tool_smith_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/butcher/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.butcher",
  "table": "trading/butcher_trades.json",
  "convert_trades_economy": true
}

 * At /minecraft:entity/component_groups/leatherworker/minecraft:trade_table/: 
"minecraft:trade_table": {
  "display_name": "entity.villager.leather",
  "table": "trading/leather_worker_trades.json",
  "convert_trades_economy": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Trade Table (minecraft:trade_table)
 * Defines this entity's ability to trade with players.
 */
export default interface MinecraftTradeTable {

  /**
   * @remarks
   * Determines when the mob transforms, if the trades should be
   * converted when the new mob has a economy_trade_table. When the
   * trades are converted, the mob will generate a new trade list with
   * their new trade table, but then it will try to convert any of
   * the same trades over to have the same enchantments and user data.
   * For example, if the original has a Emerald to Enchanted Iron
   * Sword (Sharpness 1), and the new trade also has an Emerald for
   * Enchanted Iron Sword, then the enchantment will be Sharpness 
   * 1.
   * 
   * Sample Values:
   * Villager: true
   *
   */
  convert_trades_economy: boolean;

  /**
   * @remarks
   * Name to be displayed while trading with this entity.
   * 
   * Sample Values:
   * Villager: "entity.villager.farmer", "entity.villager.fisherman", "entity.villager.shepherd", "entity.villager.fletcher", "entity.villager.librarian", "entity.villager.cartographer", "entity.villager.cleric", "entity.villager.armor", "entity.villager.weapon", "entity.villager.tool", "entity.villager.butcher", "entity.villager.leather"
   *
   */
  display_name: string;

  /**
   * @remarks
   * Used to determine if trading with entity opens the new trade
   * screen.
   */
  new_screen: boolean;

  /**
   * @remarks
   * Determines if the trades should persist when the mob transforms. This
   * makes it so that the next time the mob is transformed to
   * something with a trade_table or economy_trade_table, then it
   * keeps their trades.
   */
  persist_trades: boolean;

  /**
   * @remarks
   * File path relative to the behavior pack root for this entity's
   * trades.
   * 
   * Sample Values:
   * Villager: "trading/farmer_trades.json", "trading/fisherman_trades.json", "trading/shepherd_trades.json", "trading/fletcher_trades.json", "trading/librarian_trades.json", "trading/cartographer_trades.json", "trading/cleric_trades.json", "trading/armorer_trades.json", "trading/weapon_smith_trades.json", "trading/tool_smith_trades.json", "trading/butcher_trades.json", "trading/leather_worker_trades.json"
   *
   */
  table: string;

}