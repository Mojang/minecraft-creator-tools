// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Axe - chopping tool.
 */
export class AxeItemTrait extends ItemContentTrait {
  get id(): string {
    return "axe";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const miningSpeed = config?.miningSpeed ?? 1.2;
    const durability = config?.durability ?? 250;

    return {
      id: "axe",
      displayName: "Axe",
      description: "Chopping tool",
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
              block: { tags: "q.any_tag('wood', 'log')" },
              speed: miningSpeed,
            },
          ],
        },
        "minecraft:enchantable": {
          value: 10,
          slot: "axe",
        },
      },
    };
  }
}
