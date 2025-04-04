// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:loot
 * 
 * minecraft:loot Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:loot": "loot_tables/mikeamm/gray_wave/fabricator.loot.json

Block Gray Ore - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/gray_ore.block.json

"minecraft:loot": "loot_tables/mikeamm/gray_wave/gray_ore.loot.json

Block Orange Ore - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/basic_orange_ore/behavior_packs/basic_orange_ore/blocks/orange_ore.block.json

"minecraft:loot": "loot_tables/blocks/orange_ore.json

Apple Block - https://github.com/microsoft/minecraft-samples/tree/main/custom_features/example_feature_set/behavior_packs/example_feature_set/blocks/apple_block.json

"minecraft:loot": "loot_tables/blocks/apple_block.json
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Loot (minecraft:loot)
 * The path to the loot table, relative to the behavior pack. Path
 * string is limited to 256 characters.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface MinecraftLoot {

}