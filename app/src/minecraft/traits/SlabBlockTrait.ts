// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Slab - half-height block.
 */
export class SlabBlockTrait extends BlockContentTrait {
  get id(): string {
    return "slab";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "slab",
      displayName: "Slab",
      description: "Half-height block",
      category: "placement",
      components: {
        "minecraft:collision_box": {
          origin: [-8, 0, -8],
          size: [16, 8, 16],
        },
        "minecraft:selection_box": {
          origin: [-8, 0, -8],
          size: [16, 8, 16],
        },
      },
      properties: {
        "custom:half": ["bottom", "top", "double"],
      },
      permutations: [
        {
          condition: "q.block_state('custom:half') == 'bottom'",
          components: {
            "minecraft:collision_box": { origin: [-8, 0, -8], size: [16, 8, 16] },
            "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 8, 16] },
          },
        },
        {
          condition: "q.block_state('custom:half') == 'top'",
          components: {
            "minecraft:collision_box": { origin: [-8, 8, -8], size: [16, 8, 16] },
            "minecraft:selection_box": { origin: [-8, 8, -8], size: [16, 8, 16] },
          },
        },
        {
          condition: "q.block_state('custom:half') == 'double'",
          components: {
            "minecraft:collision_box": { origin: [-8, 0, -8], size: [16, 16, 16] },
            "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 16, 16] },
          },
        },
      ],
    };
  }
}
