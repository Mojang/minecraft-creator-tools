// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:light_emission
 * 
 * minecraft:light_emission Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:light_emission": 7

Block Gray Ore - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/gray_ore.block.json

"minecraft:light_emission": 15
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Light Emission (minecraft:light_emission)
 * The amount of light this block will emit in a range (0-15). Higher
 * value means more light will be emitted.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Integer number`.

 */
export default interface MinecraftLightEmission {

}