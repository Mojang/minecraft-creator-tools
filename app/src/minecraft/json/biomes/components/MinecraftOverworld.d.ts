// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:overworld
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Overworld Biome (minecraft:overworld)
 * Controls the blocks used for the default Minecraft Overworld terrain
 * generation.
 */
export default interface MinecraftOverworld {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: MinecraftOverworldFoundationMaterial;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome
   */
  mid_material: MinecraftOverworldMidMaterial;

  /**
   * @remarks
   * Controls how deep below the world water level the floor should
   * occur
   */
  sea_floor_depth: number;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome
   */
  sea_floor_material: MinecraftOverworldSeaFloorMaterial;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: MinecraftOverworldSeaMaterial;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: MinecraftOverworldTopMaterial;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


/**
 * Foundation Material (foundation_material)
 */
export interface MinecraftOverworldFoundationMaterial {

}


/**
 * Mid Material (mid_material)
 */
export interface MinecraftOverworldMidMaterial {

}


/**
 * Sea Floor Material (sea_floor_material)
 */
export interface MinecraftOverworldSeaFloorMaterial {

}


/**
 * Sea Material (sea_material)
 */
export interface MinecraftOverworldSeaMaterial {

}


/**
 * Top Material (top_material)
 */
export interface MinecraftOverworldTopMaterial {

}