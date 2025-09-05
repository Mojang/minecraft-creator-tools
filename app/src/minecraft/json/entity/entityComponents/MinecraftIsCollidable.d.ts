// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:is_collidable
 * 
 * minecraft:is_collidable Samples

Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:is_collidable": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Collidable (minecraft:is_collidable)
 * Allows other mobs to have vertical and horizontal collisions with
 * this mob. For a collision to occur, both mobs must have a
 * "minecraft:collision_box" component. This component can only be
 * used on mobs and enables collisions exclusively between mobs.
Please note
 * that this type of collision is unreliable for moving collidable mobs.
 * It is recommended to use this component only in scenarios where
 * the collidable mob remains stationary.
Collidable behavior is
 * closely related to stackable behavior. While the
 * "minecraft:is_collidable" component governs how other mobs
 * interact with the component's owner, the
 * "minecraft:is_stackable" component describes how an entity
 * interacts with others of its own kind.
 */
export default interface MinecraftIsCollidable {

}