// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Flammable - block can catch fire and be destroyed by flames.
 */
export class FlammableBlockTrait extends BlockContentTrait {
  get id(): string {
    return "flammable";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const catchChance = config?.catchChanceModifier ?? 5;
    const destroyChance = config?.destroyChanceModifier ?? 20;

    return {
      id: "flammable",
      displayName: "Flammable",
      description: "Can catch fire and burn",
      category: "special",
      components: {
        "minecraft:flammable": {
          catch_chance_modifier: catchChance,
          destroy_chance_modifier: destroyChance,
        },
      },
    };
  }
}
