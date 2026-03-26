// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Leggings - leg armor.
 */
export class LeggingsItemTrait extends ItemContentTrait {
  get id(): string {
    return "leggings";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const protection = config?.protection ?? 5;
    const durability = config?.durability ?? 225;

    return {
      id: "leggings",
      displayName: "Leggings",
      description: "Leg armor",
      category: "armor",
      components: {
        "minecraft:armor": {
          protection: protection,
        },
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:wearable": {
          slot: "slot.armor.legs",
          dispensable: true,
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "armor_legs",
        },
      },
    };
  }
}
