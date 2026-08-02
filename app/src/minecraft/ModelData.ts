// Unit cube block with texture
// Create a standard 16x16x16 unit cube geometry (1 block)
export const UnitCubeGeometry = {
  format_version: "1.12.0",
  "minecraft:geometry": [
    {
      description: {
        identifier: "geometry.unit_cube",
        texture_width: 16,
        texture_height: 16,
        visible_bounds_width: 1,
        visible_bounds_height: 1,
        visible_bounds_offset: [0, 0.5, 0],
      },
      bones: [
        {
          name: "body",
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-8, 0, -8],
              size: [16, 16, 16],
              // A block texture is a single face image, not a Bedrock box-UV atlas.
              // Map the full texture onto each cube face explicitly.
              uv: {
                north: { uv: [0, 0], uv_size: [16, 16] },
                east: { uv: [0, 0], uv_size: [16, 16] },
                south: { uv: [0, 0], uv_size: [16, 16] },
                west: { uv: [0, 0], uv_size: [16, 16] },
                up: { uv: [0, 0], uv_size: [16, 16] },
                down: { uv: [0, 0], uv_size: [16, 16] },
              },
            },
          ],
        },
      ],
    },
  ],
} as const;
