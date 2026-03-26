// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Metal material - strong and blast resistant.
 */
export class MetalMaterialBlockTrait extends BlockContentTrait {
  get id(): string {
    return "metal_material";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const hardness = config?.hardness ?? 5.0;

    return {
      id: "metal_material",
      displayName: "Metal Material",
      description: "Strong and blast resistant",
      category: "material",
      components: {
        "minecraft:destructible_by_mining": {
          seconds_to_destroy: hardness,
        },
        "minecraft:destructible_by_explosion": {
          explosion_resistance: 6.0,
        },
        "minecraft:map_color": "#C0C0C0",
      },
    };
  }
}
