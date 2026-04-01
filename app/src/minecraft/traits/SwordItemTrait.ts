// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Sword - melee weapon.
 */
export class SwordItemTrait extends ItemContentTrait {
  get id(): string {
    return "sword";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const damage = config?.damage ?? 5;
    const durability = config?.durability ?? 250;

    return {
      id: "sword",
      displayName: "Sword",
      description: "Melee weapon",
      category: "tool",
      components: {
        "minecraft:damage": {
          value: damage,
        },
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:hand_equipped": true,
        "minecraft:enchantable": {
          value: 10,
          slot: "sword",
        },
        "minecraft:can_destroy_in_creative": false,
      },
    };
  }
}
