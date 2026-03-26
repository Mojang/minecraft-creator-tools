// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Repairable - can be repaired.
 */
export class RepairableItemTrait extends ItemContentTrait {
  get id(): string {
    return "repairable";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const repairItems = config?.repairItems ?? ["minecraft:iron_ingot"];

    return {
      id: "repairable",
      displayName: "Repairable",
      description: "Can be repaired",
      category: "special",
      components: {
        "minecraft:repairable": {
          repair_items: repairItems.map((item: string) => ({
            items: [item],
            repair_amount: "context.other->q.remaining_durability + 0.05 * context.other->q.max_durability",
          })),
        },
      },
    };
  }
}
