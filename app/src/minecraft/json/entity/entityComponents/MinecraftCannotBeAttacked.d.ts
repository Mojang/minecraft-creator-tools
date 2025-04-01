// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:cannot_be_attacked
 * 
 * minecraft:cannot_be_attacked Samples

Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ghast.json

"minecraft:cannot_be_attacked": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Cannot Be Attacked (minecraft:cannot_be_attacked)
 * When set, blocks entities from attacking the owner entity unless
 * they have the "minecraft:ignore_cannot_be_attacked" 
 * component.
 */
export default interface MinecraftCannotBeAttacked {

}