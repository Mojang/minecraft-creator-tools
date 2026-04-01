// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { EntityContentTrait, IEntityTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Trader - can trade with the player.
 */
export class TraderEntityTrait extends EntityContentTrait {
  get id(): string {
    return "trader";
  }

  getData(_config?: ITraitConfig): IEntityTraitData {
    return {
      id: "trader",
      displayName: "Trader",
      description: "Can trade with the player",
      category: "interaction",
      components: {
        "minecraft:trade_table": {
          display_name: "entity.trader.name",
          table: "trading/custom_trades.json",
        },
        "minecraft:economy_trade_table": {
          display_name: "entity.trader.name",
          table: "trading/custom_trades.json",
          new_screen: true,
        },
      },
    };
  }
}
