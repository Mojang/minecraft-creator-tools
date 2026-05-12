// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Slippery - low-friction surface like ice.
 * Friction range is 0.0-0.9 where lower = more slippery.
 * Default block friction is 0.4; this uses 0.1 for a very slippery surface.
 */
export class SlipperyBlockTrait extends BlockContentTrait {
  get id(): string {
    return "slippery";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const friction = config?.friction ?? 0.1;

    return {
      id: "slippery",
      displayName: "Slippery",
      description: "Low-friction surface, entities slide",
      category: "special",
      components: {
        "minecraft:friction": friction,
      },
    };
  }
}
