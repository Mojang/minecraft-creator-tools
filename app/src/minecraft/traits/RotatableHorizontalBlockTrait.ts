// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Rotatable horizontal - can be placed in 4 directions.
 */
export class RotatableHorizontalBlockTrait extends BlockContentTrait {
  get id(): string {
    return "rotatable_horizontal";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "rotatable_horizontal",
      displayName: "Rotatable Horizontal",
      description: "Can be placed in 4 directions",
      category: "placement",
      components: {
        "minecraft:transformation": {
          rotation: [0, 0, 0],
        },
      },
      properties: {
        "custom:direction": [0, 1, 2, 3],
      },
      permutations: [
        {
          condition: "q.block_state('custom:direction') == 0",
          components: { "minecraft:transformation": { rotation: [0, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 1",
          components: { "minecraft:transformation": { rotation: [0, 90, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 2",
          components: { "minecraft:transformation": { rotation: [0, 180, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 3",
          components: { "minecraft:transformation": { rotation: [0, 270, 0] } },
        },
      ],
    };
  }
}
