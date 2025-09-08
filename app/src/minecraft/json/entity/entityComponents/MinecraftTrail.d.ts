// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:trail
 * 
 * minecraft:trail Samples

Snow Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snow_golem.json

"minecraft:trail": {
  "block_type": "minecraft:snow_layer",
  "spawn_filter": {
    "test": "is_temperature_value",
    "operator": "<",
    "value": 0.81
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Trail (minecraft:trail)
 * Causes an entity to leave a trail of blocks as it moves about the
 * world.
 */
export default interface MinecraftTrail {

  /**
   * @remarks
   * The type of block you wish to be spawned by the entity as it
   * move about the world. Solid blocks may not be spawned at an
   * offset of (0,0,0).
   * 
   * Sample Values:
   * Snow Golem: "minecraft:snow_layer"
   *
   */
  block_type?: string;

  /**
   * @remarks
   * One or more conditions that must be met in order to cause the
   * chosen block type to spawn.
   * 
   * Sample Values:
   * Snow Golem: {"test":"is_temperature_value","operator":"<","value":0.81}
   *
   */
  spawn_filter?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The distance from the entities current position to spawn the
   * block. Capped at up to 16 blocks away. The X value is
   * left/right(-/+), the Z value is backward/forward(-/+), the Y
   * value is below/above(-/+).
   */
  spawn_offset?: number[];

}