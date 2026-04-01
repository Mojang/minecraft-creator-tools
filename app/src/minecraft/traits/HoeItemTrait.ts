// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Hoe - farming tool.
 */
export class HoeItemTrait extends ItemContentTrait {
  get id(): string {
    return "hoe";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const durability = config?.durability ?? 250;

    return {
      id: "hoe",
      displayName: "Hoe",
      description: "Farming tool",
      category: "tool",
      components: {
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:hand_equipped": true,
        "minecraft:enchantable": {
          value: 10,
          slot: "hoe",
        },
      },
    };
  }
}
