// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Shovel - digging tool.
 */
export class ShovelItemTrait extends ItemContentTrait {
  get id(): string {
    return "shovel";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const miningSpeed = config?.miningSpeed ?? 1.2;
    const durability = config?.durability ?? 250;

    return {
      id: "shovel",
      displayName: "Shovel",
      description: "Digging tool",
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
              block: { tags: "q.any_tag('dirt', 'sand', 'gravel', 'soul_sand', 'snow')" },
              speed: miningSpeed,
            },
          ],
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "shovel",
        },
      },
    };
  }
}
