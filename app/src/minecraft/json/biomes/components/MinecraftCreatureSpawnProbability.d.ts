// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:creature_spawn_probability
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Creature Spawn Probability Biome
 * (minecraft:creature_spawn_probability)
 * Probability that creatures will spawn within the biome when a
 * chunk is generated.
 */
export default interface MinecraftCreatureSpawnProbability {

  /**
   * @remarks
   * Probabiltity between [0.0, 0.75] of creatures spawning within the
   * biome on chunk generation.
   */
  probability: number;

}