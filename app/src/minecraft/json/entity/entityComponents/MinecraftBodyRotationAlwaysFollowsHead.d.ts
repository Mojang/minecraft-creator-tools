// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:body_rotation_always_follows_head
 * 
 * minecraft:body_rotation_always_follows_head Samples

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:body_rotation_always_follows_head": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Body Rotation Always Follows Head
 * (minecraft:body_rotation_always_follows_head)
 * Causes the entity's body rotation to match the one of their
 * head.
Does not override the "minecraft:body_rotation_blocked" 
 * component.
 */
export default interface MinecraftBodyRotationAlwaysFollowsHead {

}