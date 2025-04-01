// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:input_ground_controlled
 * 
 * minecraft:input_ground_controlled Samples

Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:input_ground_controlled": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Input Ground Controlled (minecraft:input_ground_controlled)
 * When configured as a rideable entity, the entity will be
 * controlled using WASD controls. Beginning with 1.19.50 the
 * default auto step height for rideable entities is half a
 * block. Consider adding the "minecraft:variable_max_auto_step" component
 * to increase it.
 */
export default interface MinecraftInputGroundControlled {

}