// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:body_rotation_axis_aligned
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Body Rotation Axis Aligned 
 * (minecraft:body_rotation_axis_aligned)
 * Causes the entity's body to automatically rotate to align with
 * the nearest cardinal direction based on its current facing
 * direction.
Combining this with the
 * "minecraft:body_rotation_blocked" component will cause the
 * entity to align to the nearest cardinal direction and remain fixed
 * in that orientation, regardless of future changes in its facing
 * direction.
 */
export default interface MinecraftBodyRotationAxisAligned {

}