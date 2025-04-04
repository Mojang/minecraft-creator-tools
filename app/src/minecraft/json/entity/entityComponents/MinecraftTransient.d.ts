// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:transient
 * 
 * minecraft:transient Samples

Fishing Hook - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fishing_hook.json

"minecraft:transient": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Transient (minecraft:transient)
 * An entity with this component will NEVER persist, and forever
 * disappear when unloaded.
 */
export default interface MinecraftTransient {

}