// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:swamp
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Swamp (minecraft:swamp)
 * Used to add decoration to the surface of swamp biomes such as
 * water lilies.
 */
export default interface MinecraftSwamp {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: string;

  /**
   * @remarks
   * Controls the depth at which surface level blocks can be
   * replaced with water for puddles. The number represents the
   * number of blocks (0, 127) below sea level that we will go down to
   * look for a surface block.
   */
  max_puddle_depth_below_sea_level: number;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: string;

  /**
   * @remarks
   * Controls how deep below the world water level the floor should
   * occur.
   */
  sea_floor_depth: number;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome.
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: string;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


export enum MinecraftSwampType {
  minecraftCapped = `minecraft:capped`,
  minecraftFrozenOcean = `minecraft:frozen_ocean`,
  minecraftMesa = `minecraft:mesa`,
  minecraftOverworld = `minecraft:overworld`,
  minecraftSwamp = `minecraft:swamp`,
  minecraftTheEnd = `minecraft:the_end`
}