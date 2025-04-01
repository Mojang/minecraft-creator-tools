// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:geometry
 * 
 * minecraft:geometry Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:geometry": "geometry.mikeamm_gwve_fabricator

Block Gray Ore - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/gray_ore.block.json

"minecraft:geometry": "geometry.mikeamm_gwve_gray_ore

Tuna Roll - https://github.com/microsoft/minecraft-samples/tree/main/culled_block_sample/culled_block_behavior_pack/blocks/tuna_roll.json

"minecraft:geometry": {
  "identifier": "geometry.sushi",
  "culling": "test:sushi_cull"
}


Blue Bubble Fish - https://github.com/microsoft/minecraft-samples/tree/main/custom_blocks/behavior_packs/custom_blocks/blocks/blue_bubble_fish.json

"minecraft:geometry": {
  "identifier": "geometry.bubble_fish",
  "bone_visibility": {
    "bb_main": true,
    "fish": true
  }
}


California Roll - https://github.com/microsoft/minecraft-samples/tree/main/custom_blocks/behavior_packs/custom_blocks/blocks/california_roll.json

"minecraft:geometry": "geometry.sushi

Die - https://github.com/microsoft/minecraft-samples/tree/main/custom_blocks/behavior_packs/custom_blocks/blocks/die.json

"minecraft:geometry": {
  "identifier": "minecraft:geometry.full_block"
}


Block Orange Ore - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/basic_orange_ore/behavior_packs/basic_orange_ore/blocks/orange_ore.block.json

"minecraft:geometry": "geometry.orange_ore

Apple Block - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/example_feature_set/behavior_packs/example_feature_set/blocks/apple_block.json

"minecraft:geometry": "geometry.apple_block

Luckyblock - https://github.com/microsoft/minecraft-samples/tree/main/lucky_block/version_1/behavior_packs/mike_luck/blocks/luckyblock.json

"minecraft:geometry": "geometry.luckyblock

Block Frond Top - https://github.com/microsoft/minecraft-samples/tree/main/palm_tree_blocks_and_features/palm_tree_blocks/behavior_packs/palm_tree/blocks/frond_top.block.json

"minecraft:geometry": "geometry.frond_top

Block Palm Leave Corner - https://github.com/microsoft/minecraft-samples/tree/main/palm_tree_blocks_and_features/palm_tree_blocks/behavior_packs/palm_tree/blocks/palm_leave_corner.block.json

"minecraft:geometry": "geometry.palm_leave_corner

Block Palm Leave Tip - https://github.com/microsoft/minecraft-samples/tree/main/palm_tree_blocks_and_features/palm_tree_blocks/behavior_packs/palm_tree/blocks/palm_leave_tip.block.json

"minecraft:geometry": "geometry.palm_leave_tip
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Geometry (minecraft:geometry)
 * The description identifier of the geometry to use to render this
 * block. This identifier must either match an existing geometry
 * identifier in any of the loaded resource packs or be one of the
 * currently supported Vanilla identifiers: "minecraft:geometry.full_block" or
 * "minecraft:geometry.cross".
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface MinecraftGeometry {

  /**
   * @remarks
   * 
   * Sample Values:
   * Blue Bubble Fish: {"bb_main":true,"fish":true}
   *
   *
   */
  bone_visibility: { [key: string]: boolean };

  /**
   * @remarks
   * 
   * Sample Values:
   * Tuna Roll: "test:sushi_cull"
   *
   */
  culling: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Tuna Roll: "geometry.sushi"
   *
   * Blue Bubble Fish: "geometry.bubble_fish"
   *
   * Die: "minecraft:geometry.full_block"
   *
   */
  identifier: string;

}