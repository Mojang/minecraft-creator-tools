// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Explosion resistant - block is highly resistant or immune to explosions.
 */
export class ExplosionResistantBlockTrait extends BlockContentTrait {
  get id(): string {
    return "explosion_resistant";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const resistance = config?.explosionResistance ?? 1200;

    return {
      id: "explosion_resistant",
      displayName: "Explosion Resistant",
      description: "Highly resistant to explosions",
      category: "special",
      components: {
        "minecraft:destructible_by_explosion": {
          explosion_resistance: resistance,
        },
      },
    };
  }
}
