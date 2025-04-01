// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:display_name
 * 
 * minecraft:display_name Samples

Luckyblock - https://github.com/microsoft/minecraft-samples/tree/main/lucky_block/version_1/behavior_packs/mike_luck/blocks/luckyblock.json

"minecraft:display_name": "Lucky Block
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Display Name (minecraft:display_name)
 * Specifies the language file key that maps to what text will be
 * displayed when you hover over the block in your inventory and
 * hotbar. If the string given can not be resolved as a loc string, the
 * raw string given will be displayed. If this component is
 * omitted, the name of the block will be used as the display 
 * name.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface MinecraftDisplayName {

}