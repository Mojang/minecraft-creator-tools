// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:destructible_by_explosion
 * 
 * minecraft:destructible_by_explosion Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:destructible_by_explosion": {
  "explosion_resistance": 15
}


Block Gray Ore - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/gray_ore.block.json

"minecraft:destructible_by_explosion": {
  "explosion_resistance": 96
}


Block Orange Ore - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/basic_orange_ore/behavior_packs/basic_orange_ore/blocks/orange_ore.block.json

"minecraft:destructible_by_explosion": {
  "explosion_resistance": 30
}


Apple Block - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/example_feature_set/behavior_packs/example_feature_set/blocks/apple_block.json

"minecraft:destructible_by_explosion": {
  "explosion_resistance": 2.9
}


Block Palm Leave - https://github.com/microsoft/minecraft-samples/tree/main/palm_tree_blocks_and_features/palm_tree_blocks/behavior_packs/palm_tree/blocks/palm_leave.block.json

"minecraft:destructible_by_explosion": {
  "explosion_resistance": 1.3
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Destructible By Explosion 
 * (minecraft:destructible_by_explosion)
 * Describes the destructible by explosion properties for this
 * block. If set to true, the block will have the default explosion
 * resistance. If set to false, this block is indestructible by
 * explosion. If the component is omitted, the block will have the
 * default explosion resistance.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftDestructibleByExplosion {

  /**
   * @remarks
   * Sets the explosion resistance for the block. Greater values result
   * in greater resistance to explosions. The scale will be
   * different for different explosion power levels. A negative value
   * or 0 means it will easily explode; larger numbers increase level
   * of resistance.
   * 
   * Sample Values:
   * Block Fabricator: 15
   *
   * Block Gray Ore: 96
   *
   * Block Orange Ore: 30
   *
   */
  explosion_resistance: number;

}