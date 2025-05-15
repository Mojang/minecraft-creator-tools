// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:leashable_to
 * 
 * minecraft:leashable_to Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:leashable_to": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Leashable To (minecraft:leashable_to)
 * Allows players to leash entities to this entity, retrieve entities
 * already leashed to it, or free them using shears. For the last
 * interaction to work, the leashed entities must have "can_be_cut" set
 * to true in their "minecraft:leashable" component.
 */
export default interface MinecraftLeashableTo {

  /**
   * @remarks
   * Allows players to retrieve entities that are leashed to this
   * entity.
   */
  can_retrieve_from: boolean;

}