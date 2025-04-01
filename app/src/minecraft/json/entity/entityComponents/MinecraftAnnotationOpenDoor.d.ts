// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:annotation.open_door
 * 
 * minecraft:annotation.open_door Samples

Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:annotation.open_door": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Open doors annotation (minecraft:annotation.open_door)
 * Allows the entity to open doors.
 * Note: Requires the entity's `navigation` component to have the
 * parameter `can_open_doors` set to `true`.
 */
export default interface MinecraftAnnotationOpenDoor {

}