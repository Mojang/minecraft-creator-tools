// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Food - can be eaten.
 */
export class FoodItemTrait extends ItemContentTrait {
  get id(): string {
    return "food";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const nutrition = config?.nutrition ?? 4;
    const saturation = config?.saturation ?? 0.6;

    return {
      id: "food",
      displayName: "Food",
      description: "Can be eaten",
      category: "consumable",
      components: {
        "minecraft:food": {
          nutrition: nutrition,
          saturation_modifier: saturation,
          can_always_eat: false,
        },
        "minecraft:use_modifiers": {
          use_duration: 1.6,
        },
      },
    };
  }
}
