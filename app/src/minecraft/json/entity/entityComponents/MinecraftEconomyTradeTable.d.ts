// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:economy_trade_table
 * 
 * minecraft:economy_trade_table Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/trade_components/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {}

 * At /minecraft:entity/component_groups/farmer/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.farmer",
  "table": "trading/economy_trades/farmer_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/fisherman/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.fisherman",
  "table": "trading/economy_trades/fisherman_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/shepherd/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.shepherd",
  "table": "trading/economy_trades/shepherd_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/fletcher/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.fletcher",
  "table": "trading/economy_trades/fletcher_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/librarian/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.librarian",
  "table": "trading/economy_trades/librarian_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/cartographer/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.cartographer",
  "table": "trading/economy_trades/cartographer_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/cleric/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.cleric",
  "table": "trading/economy_trades/cleric_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/armorer/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.armor",
  "table": "trading/economy_trades/armorer_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/weaponsmith/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.weapon",
  "table": "trading/economy_trades/weapon_smith_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/toolsmith/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.tool",
  "table": "trading/economy_trades/tool_smith_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/butcher/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.butcher",
  "table": "trading/economy_trades/butcher_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/leatherworker/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.leather",
  "table": "trading/economy_trades/leather_worker_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 * At /minecraft:entity/component_groups/mason/minecraft:economy_trade_table/: 
"minecraft:economy_trade_table": {
  "display_name": "entity.villager.mason",
  "table": "trading/economy_trades/stone_mason_trades.json",
  "new_screen": true,
  "persist_trades": true,
  "cured_discount": [
    -25,
    -20
  ],
  "max_cured_discount": [
    -25,
    -20
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Economy Trade Table (minecraft:economy_trade_table)
 * Defines this entity's ability to trade with players.
 */
export default interface MinecraftEconomyTradeTable {

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
   */
  convert_trades_economy: boolean;

  /**
   * @remarks
   * How much should the discount be modified by when the player has
   * cured the Zombie Villager. Can be specified as a pair of
   * numbers (When use_legacy_price_formula is true this is the
   * low-tier trade discount and high-tier trade discount, otherwise it
   * is the minor positive gossip and major positive gossip.)
   * 
   * Sample Values:
   * Villager v2: [-25,-20]
   *
   */
  cured_discount: number[];

  /**
   * @remarks
   * Name to be displayed while trading with this entity
   * 
   * Sample Values:
   * Villager v2: "entity.villager.farmer", "entity.villager.fisherman", "entity.villager.shepherd", "entity.villager.fletcher", "entity.villager.librarian", "entity.villager.cartographer", "entity.villager.cleric", "entity.villager.armor", "entity.villager.weapon", "entity.villager.tool", "entity.villager.butcher", "entity.villager.leather", "entity.villager.mason"
   *
   */
  display_name: string;

  /**
   * @remarks
   * Used in legacy prices to determine how much should Demand be
   * modified by when the player has the Hero of the Village mob
   * effect
   */
  hero_demand_discount: number;

  /**
   * @remarks
   * The max the discount can be modified by when the player has
   * cured the Zombie Villager. Can be specified as a pair of
   * numbers (When use_legacy_price_formula is true this is the
   * low-tier trade discount and high-tier trade discount, otherwise it
   * is the minor positive gossip and major positive gossip.)
   * 
   * Sample Values:
   * Villager v2: [-25,-20]
   *
   */
  max_cured_discount: number[];

  /**
   * @remarks
   * The max the discount can be modified by when the player has
   * cured a nearby Zombie Villager. Only used when
   * use_legacy_price_formula is true, otherwise max_cured_discount (low)
   * is used.
   */
  max_nearby_cured_discount: number;

  /**
   * @remarks
   * How much should the discount be modified by when the player has
   * cured a nearby Zombie Villager
   */
  nearby_cured_discount: number;

  /**
   * @remarks
   * Used to determine if trading with entity opens the new trade
   * screen
   * 
   * Sample Values:
   * Villager v2: true
   *
   */
  new_screen: boolean;

  /**
   * @remarks
   * Determines if the trades should persist when the mob transforms. This
   * makes it so that the next time the mob is transformed to
   * something with a trade_table or economy_trade_table, then it
   * keeps their trades.
   * 
   * Sample Values:
   * Villager v2: true
   *
   */
  persist_trades: boolean;

  /**
   * @remarks
   * Show an in game trade screen when interacting with the mob.
   */
  show_trade_screen: boolean;

  /**
   * @remarks
   * File path relative to the resource pack root for this entity's 
   * trades
   * 
   * Sample Values:
   * Villager v2: "trading/economy_trades/farmer_trades.json", "trading/economy_trades/fisherman_trades.json", "trading/economy_trades/shepherd_trades.json", "trading/economy_trades/fletcher_trades.json", "trading/economy_trades/librarian_trades.json", "trading/economy_trades/cartographer_trades.json", "trading/economy_trades/cleric_trades.json", "trading/economy_trades/armorer_trades.json", "trading/economy_trades/weapon_smith_trades.json", "trading/economy_trades/tool_smith_trades.json", "trading/economy_trades/butcher_trades.json", "trading/economy_trades/leather_worker_trades.json", "trading/economy_trades/stone_mason_trades.json"
   *
   */
  table: string;

  /**
   * @remarks
   * Determines whether the legacy formula is used to determines the
   * trade prices.
   */
  use_legacy_price_formula: boolean;

}