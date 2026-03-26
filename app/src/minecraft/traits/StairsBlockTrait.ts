// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Stairs - stair-shaped block.
 */
export class StairsBlockTrait extends BlockContentTrait {
  get id(): string {
    return "stairs";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "stairs",
      displayName: "Stairs",
      description: "Stair-shaped block",
      category: "placement",
      components: {
        "minecraft:geometry": "geometry.stairs",
        "minecraft:transformation": {
          rotation: [0, 0, 0],
        },
      },
      properties: {
        "custom:direction": [0, 1, 2, 3],
        "custom:upside_down": [false, true],
      },
      permutations: [
        {
          condition: "q.block_state('custom:direction') == 0 && !q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [0, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 1 && !q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [0, 90, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 2 && !q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [0, 180, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 3 && !q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [0, 270, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 0 && q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [180, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 1 && q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [180, 90, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 2 && q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [180, 180, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 3 && q.block_state('custom:upside_down')",
          components: { "minecraft:transformation": { rotation: [180, 270, 0] } },
        },
      ],
    };
  }
}
