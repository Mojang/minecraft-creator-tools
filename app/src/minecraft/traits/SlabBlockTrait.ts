// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Slab geometry definition.
 * A single half-height cube (16×8×16 in pixel units).
 */
const SLAB_GEOMETRY = {
  format_version: "1.21.40",
  "minecraft:geometry": [
    {
      description: {
        identifier: "geometry.slab",
        texture_width: 16,
        texture_height: 16,
      },
      bones: [
        {
          name: "body",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-8, 0, -8],
              size: [16, 8, 16],
              uv: {
                north: { uv: [0, 8], uv_size: [16, 8] },
                south: { uv: [0, 8], uv_size: [16, 8] },
                east: { uv: [0, 8], uv_size: [16, 8] },
                west: { uv: [0, 8], uv_size: [16, 8] },
                up: { uv: [0, 0], uv_size: [16, 16] },
                down: { uv: [0, 0], uv_size: [16, 16] },
              },
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Slab - half-height block.
 * Uses the minecraft:placement_position trait with minecraft:vertical_half
 * to automatically handle top/bottom placement based on where the player clicks.
 */
export class SlabBlockTrait extends BlockContentTrait {
  get id(): string {
    return "slab";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "slab",
      displayName: "Slab",
      description: "Half-height block with top/bottom placement",
      category: "placement",
      components: {
        "minecraft:geometry": "geometry.slab",
        "minecraft:collision_box": {
          origin: [-8, 0, -8],
          size: [16, 8, 16],
        },
        "minecraft:selection_box": {
          origin: [-8, 0, -8],
          size: [16, 8, 16],
        },
      },
      minecraftTraits: {
        "minecraft:placement_position": {
          enabled_states: ["minecraft:vertical_half"],
        },
      },
      geometryFiles: [
        {
          path: "models/blocks/slab.geo.json",
          content: SLAB_GEOMETRY,
        },
      ],
      permutations: [
        {
          condition: "q.block_state('minecraft:vertical_half') == 'top'",
          components: {
            "minecraft:transformation": {
              translation: [0, 0.5, 0],
            },
          },
        },
      ],
    };
  }
}
