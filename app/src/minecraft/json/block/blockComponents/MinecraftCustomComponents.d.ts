// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:custom_components
 * 
 * minecraft:custom_components Samples

Luckyblock - https://github.com/microsoft/minecraft-samples/tree/main/lucky_block/version_1/behavior_packs/mike_luck/blocks/luckyblock.json

"minecraft:custom_components": [
  "mike_luck:luckyblock_actions"
]

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Custom Components (minecraft:custom_components)
 * Sets an ordered list of custom component names which are bound in
 * script to be executed upon a block event.
 */
export default interface MinecraftCustomComponents {

  /**
   * @remarks
   * 
   * Sample Values:
   * Luckyblock: "mike_luck:luckyblock_actions"
   *
   */
  _0: string;

}