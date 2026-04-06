// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BlockContentTrait, IBlockTraitData, ITraitConfig } from "./ContentTraits";

/**
 * Stairs geometry definition.
 * Two cubes: bottom half is a full slab, top half is half-depth to form the step.
 * Uses pixel units: 16×16×16 = one full block.
 */
const STAIRS_GEOMETRY = {
  format_version: "1.21.40",
  "minecraft:geometry": [
    {
      description: {
        identifier: "geometry.stairs",
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
            {
              origin: [-8, 8, 0],
              size: [16, 8, 8],
              uv: {
                north: { uv: [0, 0], uv_size: [16, 8] },
                south: { uv: [0, 0], uv_size: [16, 8] },
                east: { uv: [8, 0], uv_size: [8, 8] },
                west: { uv: [0, 0], uv_size: [8, 8] },
                up: { uv: [0, 0], uv_size: [16, 8] },
                down: { uv: [0, 0], uv_size: [16, 8] },
              },
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Stairs - stair-shaped block.
 * Uses minecraft:placement_position trait for vertical_half (upside-down placement)
 * and minecraft:connection trait for cardinal connections (connecting to adjacent stairs).
 * Requires format_version 1.21.130+ for the connection trait.
 */
export class StairsBlockTrait extends BlockContentTrait {
  get id(): string {
    return "stairs";
  }

  getData(_config?: ITraitConfig): IBlockTraitData {
    return {
      id: "stairs",
      displayName: "Stairs",
      description: "Stair-shaped block with directional placement and connections",
      category: "placement",
      components: {
        "minecraft:geometry": "geometry.stairs",
        "minecraft:transformation": {
          rotation: [0, 0, 0],
        },
      },
      properties: {
        "custom:direction": [0, 1, 2, 3],
      },
      minecraftTraits: {
        "minecraft:placement_position": {
          enabled_states: ["minecraft:vertical_half"],
        },
        "minecraft:connection": {
          enabled_states: ["minecraft:cardinal_connections"],
        },
      },
      geometryFiles: [
        {
          path: "models/blocks/stairs.geo.json",
          content: STAIRS_GEOMETRY,
        },
      ],
      permutations: [
        // Normal stairs (bottom)
        {
          condition: "q.block_state('custom:direction') == 0 && q.block_state('minecraft:vertical_half') == 'bottom'",
          components: { "minecraft:transformation": { rotation: [0, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 1 && q.block_state('minecraft:vertical_half') == 'bottom'",
          components: { "minecraft:transformation": { rotation: [0, 90, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 2 && q.block_state('minecraft:vertical_half') == 'bottom'",
          components: { "minecraft:transformation": { rotation: [0, 180, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 3 && q.block_state('minecraft:vertical_half') == 'bottom'",
          components: { "minecraft:transformation": { rotation: [0, 270, 0] } },
        },
        // Upside-down stairs (top)
        {
          condition: "q.block_state('custom:direction') == 0 && q.block_state('minecraft:vertical_half') == 'top'",
          components: { "minecraft:transformation": { rotation: [180, 0, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 1 && q.block_state('minecraft:vertical_half') == 'top'",
          components: { "minecraft:transformation": { rotation: [180, 90, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 2 && q.block_state('minecraft:vertical_half') == 'top'",
          components: { "minecraft:transformation": { rotation: [180, 180, 0] } },
        },
        {
          condition: "q.block_state('custom:direction') == 3 && q.block_state('minecraft:vertical_half') == 'top'",
          components: { "minecraft:transformation": { rotation: [180, 270, 0] } },
        },
      ],
    };
  }
}
