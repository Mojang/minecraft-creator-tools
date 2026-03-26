// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Chestplate - chest armor.
 */
export class ChestplateItemTrait extends ItemContentTrait {
  get id(): string {
    return "chestplate";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const protection = config?.protection ?? 6;
    const durability = config?.durability ?? 240;

    return {
      id: "chestplate",
      displayName: "Chestplate",
      description: "Chest armor",
      category: "armor",
      components: {
        "minecraft:armor": {
          protection: protection,
        },
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:wearable": {
          slot: "slot.armor.chest",
          dispensable: true,
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "armor_torso",
        },
      },
    };
  }
}
