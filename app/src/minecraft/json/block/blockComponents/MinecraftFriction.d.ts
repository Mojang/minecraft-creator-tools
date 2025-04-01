// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:friction
 * 
 * minecraft:friction Samples

Block Palm Leave - https://github.com/microsoft/minecraft-samples/tree/main/palm_tree_blocks_and_features/palm_tree_blocks/behavior_packs/palm_tree/blocks/palm_leave.block.json

"minecraft:friction": 0.38
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Friction (minecraft:friction)
 * Describes the friction for this block in a range of (0.0-0.9). Friction
 * affects an entity's movement speed when it travels on the block.
 * Greater value results in more friction.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Decimal number`.

 */
export default interface MinecraftFriction {

}