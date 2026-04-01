// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Soft material - easily breakable.
 */
export class SoftMaterialBlockTrait extends BlockContentTrait {
  get id(): string {
    return "soft_material";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const hardness = config?.hardness ?? 0.5;

    return {
      id: "soft_material",
      displayName: "Soft Material",
      description: "Easily breakable",
      category: "material",
      components: {
        "minecraft:destructible_by_mining": {
          seconds_to_destroy: hardness,
        },
        "minecraft:destructible_by_explosion": {
          explosion_resistance: 0.5,
        },
        "minecraft:map_color": "#D2B48C",
      },
    };
  }
}
