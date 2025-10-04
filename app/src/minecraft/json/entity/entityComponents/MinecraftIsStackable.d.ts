// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:is_stackable
 * 
 * minecraft:is_stackable Samples

Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:is_stackable": {}


Chest Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chest_minecart.json

"minecraft:is_stackable": {
  "value": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Stackable (minecraft:is_stackable)
 * Allows instances of this entity to have vertical and horizontal
 * collisions with each other. For a collision to occur, both
 * instances must have a "minecraft:collision_box" component.
Stackable behavior
 * is closely related to collidable behavior. While the
 * "minecraft:is_stackable" component describes how an entity
 * interacts with others of its own kind, the
 * "minecraft:is_collidable" component governs how other mobs
 * interact with the component's owner.
 */
export default interface MinecraftIsStackable {

  /**
   * @remarks
   * 
   * Sample Values:
   * Chest Minecart: true
   *
   */
  value?: string;

}