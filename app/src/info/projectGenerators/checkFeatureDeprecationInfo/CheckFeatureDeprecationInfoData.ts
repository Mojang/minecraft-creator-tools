// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum CheckFeatureDeprecationInfoGeneratorTest {
  deprecatedBlockOverride = 101,
  deprecatedTerrainTexture = 102,
  deprecatedTexture = 103,
  jsonParseError = 104,
}

export const DEPRECATED_BLOCKS = ["fletching_table", "smithing_table"];

export const DEPRECATED_TEXTURES = [
  "smithing_table_top.png",
  "smithing_table_side1.png",
  "smithing_table_side2.png",
  "fletcher_table_top.png",
  "fletcher_table_side1.png",
  "fletcher_table_side2.png",
];

export const DEPRECATED_TEXTURE_ENTRIES = [
  "smithing_table_top",
  "smithing_table_side_a",
  "smithing_table_side_b",
  "fletching_table_top",
  "fletching_table_side1",
  "fletching_table_side2",
];
