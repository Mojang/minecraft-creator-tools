// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:renders_when_invisible
 * 
 * minecraft:renders_when_invisible Samples

Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:renders_when_invisible": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Renders When Invisible (minecraft:renders_when_invisible)
 * When set, the entity will render even when invisible. Appropriate
 * rendering behavior can then be specified in the corresponding
 * "minecraft:client_entity".
 */
export default interface MinecraftRendersWhenInvisible {

}