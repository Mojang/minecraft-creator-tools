// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:physics
 * 
 * minecraft:physics Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:physics": {
  "has_gravity": false
}


Area Effect Cloud - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/area_effect_cloud.json

"minecraft:physics": {
  "has_collision": false
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:physics": {}


Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:physics": {
  "has_gravity": false,
  "has_collision": false
}


Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:physics": {
  "push_towards_closest_space": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Physics (minecraft:physics)
 * Defines physics properties of an actor, including if it is
 * affected by gravity or if it collides with objects.
 */
export default interface MinecraftPhysics {

  /**
   * @remarks
   * Whether or not the object collides with things.
   */
  has_collision: boolean;

  /**
   * @remarks
   * Whether or not the entity is affected by gravity.
   */
  has_gravity: boolean;

  /**
   * @remarks
   * Whether or not the entity should be pushed towards the nearest open
   * area when stuck inside a block.
   * 
   * Sample Values:
   * Player: true
   *
   */
  push_towards_closest_space: boolean;

}