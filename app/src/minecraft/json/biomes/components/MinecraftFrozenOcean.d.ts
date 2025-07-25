// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:frozen_ocean
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Frozen Ocean Biome (minecraft:frozen_ocean)
 * Similar to overworld_surface. Adds icebergs.
 */
export default interface MinecraftFrozenOcean {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: MinecraftFrozenOceanFoundationMaterial;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome
   */
  mid_material: MinecraftFrozenOceanMidMaterial;

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
  sea_floor_material: MinecraftFrozenOceanSeaFloorMaterial;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: MinecraftFrozenOceanSeaMaterial;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: MinecraftFrozenOceanTopMaterial;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


/**
 * Foundation Material (foundation_material)
 */
export interface MinecraftFrozenOceanFoundationMaterial {

}


/**
 * Mid Material (mid_material)
 */
export interface MinecraftFrozenOceanMidMaterial {

}


/**
 * Sea Floor Material (sea_floor_material)
 */
export interface MinecraftFrozenOceanSeaFloorMaterial {

}


/**
 * Sea Material (sea_material)
 */
export interface MinecraftFrozenOceanSeaMaterial {

}


/**
 * Top Material (top_material)
 */
export interface MinecraftFrozenOceanTopMaterial {

}