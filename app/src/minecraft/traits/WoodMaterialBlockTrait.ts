// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Wood material - standard wood properties.
 */
export class WoodMaterialBlockTrait extends BlockContentTrait {
  get id(): string {
    return "wood_material";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const hardness = config?.hardness ?? 2.0;

    return {
      id: "wood_material",
      displayName: "Wood Material",
      description: "Standard wood properties",
      category: "material",
      components: {
        "minecraft:destructible_by_mining": {
          seconds_to_destroy: hardness,
        },
        "minecraft:destructible_by_explosion": {
          explosion_resistance: 3.0,
        },
        "minecraft:flammable": {
          catch_chance_modifier: 5,
          destroy_chance_modifier: 20,
        },
        "minecraft:map_color": "#8B4513",
      },
    };
  }
}
