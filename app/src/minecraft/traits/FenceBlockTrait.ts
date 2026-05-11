// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Fence geometry definition.
 * Center post with 4 directional connection arms controlled by bone_visibility.
 * Uses minecraft:cardinal_connections states from the connection trait.
 */
const FENCE_GEOMETRY = {
  format_version: "1.21.40",
  "minecraft:geometry": [
    {
      description: {
        identifier: "geometry.fence",
        texture_width: 16,
        texture_height: 16,
      },
      bones: [
        {
          name: "post",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-2, 0, -2],
              size: [4, 16, 4],
              uv: {
                north: { uv: [6, 0], uv_size: [4, 16] },
                south: { uv: [6, 0], uv_size: [4, 16] },
                east: { uv: [6, 0], uv_size: [4, 16] },
                west: { uv: [6, 0], uv_size: [4, 16] },
                up: { uv: [6, 6], uv_size: [4, 4] },
                down: { uv: [6, 6], uv_size: [4, 4] },
              },
            },
          ],
        },
        {
          name: "arm_north",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-1, 6, -8],
              size: [2, 3, 6],
              uv: {
                north: { uv: [7, 0], uv_size: [2, 3] },
                south: { uv: [7, 0], uv_size: [2, 3] },
                east: { uv: [0, 0], uv_size: [6, 3] },
                west: { uv: [0, 0], uv_size: [6, 3] },
                up: { uv: [7, 0], uv_size: [2, 6] },
                down: { uv: [7, 0], uv_size: [2, 6] },
              },
            },
            {
              origin: [-1, 12, -8],
              size: [2, 3, 6],
              uv: {
                north: { uv: [7, 0], uv_size: [2, 3] },
                south: { uv: [7, 0], uv_size: [2, 3] },
                east: { uv: [0, 0], uv_size: [6, 3] },
                west: { uv: [0, 0], uv_size: [6, 3] },
                up: { uv: [7, 0], uv_size: [2, 6] },
                down: { uv: [7, 0], uv_size: [2, 6] },
              },
            },
          ],
        },
        {
          name: "arm_south",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-1, 6, 2],
              size: [2, 3, 6],
              uv: {
                north: { uv: [7, 0], uv_size: [2, 3] },
                south: { uv: [7, 0], uv_size: [2, 3] },
                east: { uv: [0, 0], uv_size: [6, 3] },
                west: { uv: [0, 0], uv_size: [6, 3] },
                up: { uv: [7, 0], uv_size: [2, 6] },
                down: { uv: [7, 0], uv_size: [2, 6] },
              },
            },
            {
              origin: [-1, 12, 2],
              size: [2, 3, 6],
              uv: {
                north: { uv: [7, 0], uv_size: [2, 3] },
                south: { uv: [7, 0], uv_size: [2, 3] },
                east: { uv: [0, 0], uv_size: [6, 3] },
                west: { uv: [0, 0], uv_size: [6, 3] },
                up: { uv: [7, 0], uv_size: [2, 6] },
                down: { uv: [7, 0], uv_size: [2, 6] },
              },
            },
          ],
        },
        {
          name: "arm_east",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [2, 6, -1],
              size: [6, 3, 2],
              uv: {
                north: { uv: [0, 0], uv_size: [6, 3] },
                south: { uv: [0, 0], uv_size: [6, 3] },
                east: { uv: [7, 0], uv_size: [2, 3] },
                west: { uv: [7, 0], uv_size: [2, 3] },
                up: { uv: [0, 7], uv_size: [6, 2] },
                down: { uv: [0, 7], uv_size: [6, 2] },
              },
            },
            {
              origin: [2, 12, -1],
              size: [6, 3, 2],
              uv: {
                north: { uv: [0, 0], uv_size: [6, 3] },
                south: { uv: [0, 0], uv_size: [6, 3] },
                east: { uv: [7, 0], uv_size: [2, 3] },
                west: { uv: [7, 0], uv_size: [2, 3] },
                up: { uv: [0, 7], uv_size: [6, 2] },
                down: { uv: [0, 7], uv_size: [6, 2] },
              },
            },
          ],
        },
        {
          name: "arm_west",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-8, 6, -1],
              size: [6, 3, 2],
              uv: {
                north: { uv: [0, 0], uv_size: [6, 3] },
                south: { uv: [0, 0], uv_size: [6, 3] },
                east: { uv: [7, 0], uv_size: [2, 3] },
                west: { uv: [7, 0], uv_size: [2, 3] },
                up: { uv: [0, 7], uv_size: [6, 2] },
                down: { uv: [0, 7], uv_size: [6, 2] },
              },
            },
            {
              origin: [-8, 12, -1],
              size: [6, 3, 2],
              uv: {
                north: { uv: [0, 0], uv_size: [6, 3] },
                south: { uv: [0, 0], uv_size: [6, 3] },
                east: { uv: [7, 0], uv_size: [2, 3] },
                west: { uv: [7, 0], uv_size: [2, 3] },
                up: { uv: [0, 7], uv_size: [6, 2] },
                down: { uv: [0, 7], uv_size: [6, 2] },
              },
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Fence - post-shaped block that connects to adjacent blocks.
 * Uses the minecraft:connection trait for automatic cardinal connection states,
 * minecraft:support shape "fence" for proper collision, and
 * bone_visibility in the geometry to show/hide connection arms.
 */
export class FenceBlockTrait extends BlockContentTrait {
  get id(): string {
    return "fence";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "fence",
      displayName: "Fence",
      description: "Fence post that connects to adjacent blocks",
      category: "shape",
      components: {
        "minecraft:geometry": {
          identifier: "geometry.fence",
          bone_visibility: {
            arm_north: "q.block_state('minecraft:north_connection') != 'none'",
            arm_south: "q.block_state('minecraft:south_connection') != 'none'",
            arm_east: "q.block_state('minecraft:east_connection') != 'none'",
            arm_west: "q.block_state('minecraft:west_connection') != 'none'",
          },
        },
        "minecraft:collision_box": {
          origin: [-2, 0, -2],
          size: [4, 24, 4],
        },
        "minecraft:selection_box": {
          origin: [-2, 0, -2],
          size: [4, 16, 4],
        },
        "minecraft:support": {
          shape: "fence",
        },
        "minecraft:connection_rule": {
          accepts_connections_from: "all",
          enabled_directions: ["north", "south", "east", "west"],
        },
      },
      minecraftTraits: {
        "minecraft:connection": {
          enabled_states: ["minecraft:cardinal_connections"],
        },
      },
      geometryFiles: [
        {
          path: "models/blocks/fence.geo.json",
          content: FENCE_GEOMETRY,
        },
      ],
    };
  }
}
