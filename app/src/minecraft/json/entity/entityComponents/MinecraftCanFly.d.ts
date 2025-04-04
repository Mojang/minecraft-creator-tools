// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:can_fly
 * 
 * minecraft:can_fly Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:can_fly": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Can Fly (minecraft:can_fly)
 * Marks the entity as being able to fly, the pathfinder won't be
 * restricted to paths where a solid block is required underneath 
 * it.
 */
export default interface MinecraftCanFly {

}