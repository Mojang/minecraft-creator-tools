// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Drink - can be drunk.
 */
export class DrinkItemTrait extends ItemContentTrait {
  get id(): string {
    return "drink";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const nutrition = config?.nutrition ?? 0;

    return {
      id: "drink",
      displayName: "Drink",
      description: "Can be drunk",
      category: "consumable",
      components: {
        "minecraft:food": {
          nutrition: nutrition,
          saturation_modifier: 0,
          can_always_eat: true,
        },
        "minecraft:use_modifiers": {
          use_duration: 2.0,
        },
      },
    };
  }
}
