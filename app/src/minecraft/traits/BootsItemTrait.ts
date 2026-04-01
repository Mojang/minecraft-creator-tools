// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Boots - foot armor.
 */
export class BootsItemTrait extends ItemContentTrait {
  get id(): string {
    return "boots";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const protection = config?.protection ?? 2;
    const durability = config?.durability ?? 195;

    return {
      id: "boots",
      displayName: "Boots",
      description: "Foot armor",
      category: "armor",
      components: {
        "minecraft:armor": {
          protection: protection,
        },
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:wearable": {
          slot: "slot.armor.feet",
          dispensable: true,
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "armor_feet",
        },
      },
    };
  }
}
