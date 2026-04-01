// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Crop - can grow over time.
 */
export class CropBlockTrait extends BlockContentTrait {
  get id(): string {
    return "crop";
  }

  getData(config?: ITraitConfig): IBlockTraitData {
    const growthStages = config?.growthStages ?? 7;

    return {
      id: "crop",
      displayName: "Crop",
      description: "Can grow over time",
      category: "special",
      components: {
        "minecraft:collision_box": false,
        "minecraft:tick": {
          interval_range: [10, 20],
          looping: true,
        },
        "minecraft:random_ticking": {
          on_tick: {
            event: "grow",
          },
        },
      },
      properties: {
        "custom:growth_stage": Array.from({ length: growthStages + 1 }, (_, i) => i),
      },
      permutations: Array.from({ length: growthStages + 1 }, (_, i) => ({
        condition: `q.block_state('custom:growth_stage') == ${i}`,
        components: {
          "minecraft:geometry": `geometry.crop_stage_${i}`,
        },
      })),
    };
  }
}
