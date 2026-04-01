// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Pickaxe - mining tool.
 */
export class PickaxeItemTrait extends ItemContentTrait {
  get id(): string {
    return "pickaxe";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const miningSpeed = config?.miningSpeed ?? 1.2;
    const durability = config?.durability ?? 250;

    return {
      id: "pickaxe",
      displayName: "Pickaxe",
      description: "Mining tool",
      category: "tool",
      components: {
        "minecraft:durability": {
          max_durability: durability,
        },
        "minecraft:hand_equipped": true,
        "minecraft:digger": {
          use_efficiency: true,
          destroy_speeds: [
            {
              block: { tags: "q.any_tag('stone', 'metal', 'diamond_pick_diggable')" },
              speed: miningSpeed,
            },
          ],
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "pickaxe",
        },
      },
    };
  }
}
