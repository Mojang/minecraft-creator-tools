// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:map_color
 * 
 * minecraft:map_color Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:map_color": "#5f4a2b

Block Gray Ore - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/gray_ore.block.json

"minecraft:map_color": "#ffcd17

Block Palm Leave Corner - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_leave_corner.block.json

"minecraft:map_color": "#495f2b

Block Palm Leave - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_leave.block.json

"minecraft:map_color": "#639f28

Block Palm Trunk - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_trunk.block.json

"minecraft:map_color": "#b9ae9d

Block White Sand - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/white_sand.block.json

"minecraft:map_color": "#fdfdfd

Block Leaf Pile - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/blocks/leaf_pile.block.json

"minecraft:map_color": "#ffffff

Block Orange Ore - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/basic_orange_ore/behavior_packs/basic_orange_ore/blocks/orange_ore.block.json

"minecraft:map_color": "#a69787

Apple Block - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/example_feature_set/behavior_packs/example_feature_set/blocks/apple_block.json

"minecraft:map_color": "#f30000
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Map Color (minecraft:map_color)
 * Sets the color of the block when rendered to a map. If this
 * component is omitted, the block will not show up on the map.
 */
export default interface MinecraftMapColor {

  /**
   * @remarks
   * The color is represented as a hex value in the format "#RRGGBB". May
   * also be expressed as an array of [R, G, B] from 0 to 255.
   */
  color: string;

  /**
   * @remarks
   * Optional, tint multiplied to the color. Tint method logic varies,
   * but often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: string;

}