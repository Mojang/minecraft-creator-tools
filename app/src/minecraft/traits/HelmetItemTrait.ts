// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Helmet - head armor.
 */
export class HelmetItemTrait extends ItemContentTrait {
  get id(): string {
    return "helmet";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const protection = config?.protection ?? 2;
    const durability = config?.durability ?? 165;

    return {
      id: "helmet",
      displayName: "Helmet",
      description: "Head armor",
      category: "armor",
      components: {
        "minecraft:armor": {
          protection: protection,
        },
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:wearable": {
          slot: "slot.armor.head",
          dispensable: true,
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "armor_head",
        },
      },
    };
  }
}
