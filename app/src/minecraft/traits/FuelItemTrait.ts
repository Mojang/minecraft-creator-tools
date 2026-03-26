// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ItemContentTrait, IItemTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Fuel - can be used as fuel in a furnace.
 */
export class FuelItemTrait extends ItemContentTrait {
  get id(): string {
    return "fuel";
  }

  getData(config?: ITraitConfig): IItemTraitData {
    const burnDuration = config?.burnDuration ?? 200;

    return {
      id: "fuel",
      displayName: "Fuel",
      description: "Can be used as fuel in a furnace",
      category: "special",
      components: {
        "minecraft:fuel": {
          duration: burnDuration,
        },
      },
    };
  }
}
