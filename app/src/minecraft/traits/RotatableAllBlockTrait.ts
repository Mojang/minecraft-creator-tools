// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Rotatable all - can be placed in 6 directions.
 */
export class RotatableAllBlockTrait extends BlockContentTrait {
  get id(): string {
    return "rotatable_all";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "rotatable_all",
      displayName: "Rotatable All",
      description: "Can be placed in 6 directions",
      category: "placement",
      components: {
        "minecraft:transformation": {
          rotation: [0, 0, 0],
        },
      },
      properties: {
        "custom:facing": ["up", "down", "north", "south", "east", "west"],
      },
      permutations: [
        {
          condition: "q.block_state('custom:facing') == 'up'",
          components: { "minecraft:transformation": { rotation: [0, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:facing') == 'down'",
          components: { "minecraft:transformation": { rotation: [180, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:facing') == 'north'",
          components: { "minecraft:transformation": { rotation: [90, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:facing') == 'south'",
          components: { "minecraft:transformation": { rotation: [-90, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:facing') == 'east'",
          components: { "minecraft:transformation": { rotation: [0, 0, -90] } },
        },
        {
          condition: "q.block_state('custom:facing') == 'west'",
          components: { "minecraft:transformation": { rotation: [0, 0, 90] } },
        },
      ],
    };
  }
}
