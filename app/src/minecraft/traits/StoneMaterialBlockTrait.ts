// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Stone material - standard stone properties.
 */
export class StoneMaterialBlockTrait extends BlockContentTrait {
  get id(): string {
    return "stone_material";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const hardness = config?.hardness ?? 1.5;

    return {
      id: "stone_material",
      displayName: "Stone Material",
      description: "Standard stone properties",
      category: "material",
      components: {
        "minecraft:destructible_by_mining": {
          seconds_to_destroy: hardness,
        },
        "minecraft:destructible_by_explosion": {
          explosion_resistance: 6.0,
        },
        "minecraft:map_color": "#808080",
      },
    };
  }
}
