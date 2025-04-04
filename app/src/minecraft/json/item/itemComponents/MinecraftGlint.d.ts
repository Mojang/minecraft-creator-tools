// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:glint
 * 
 * minecraft:glint Samples

Item Depleted Gray Shard - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/depleted_gray_shard.item.json

"minecraft:glint": true
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Glint (minecraft:glint)
 * Determines whether the item has the enchanted glint render effect
 * on it.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftGlint {

  /**
   * @remarks
   * Whether the item has the enchanted glint render effect.
   */
  value: boolean;

}