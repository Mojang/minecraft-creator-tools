// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:instant_despawn
 * 
 * minecraft:instant_despawn Samples

Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:instant_despawn": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Instant Despawn (minecraft:instant_despawn)
 * Despawns the Actor immediately.
 */
export default interface MinecraftInstantDespawn {

  /**
   * @remarks
   * If true, all entities linked to this entity in a child
   * relationship (eg. leashed) will also be despawned.
   */
  remove_child_entities?: boolean;

}