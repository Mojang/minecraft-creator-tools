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
 * Minecraft Swamp Biome (minecraft:swamp)
 * Used to add decoration to the surface of swamp biomes such as
 * water lilies.
 */
export default interface MinecraftSwamp {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: MinecraftSwampFoundationMaterial;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: MinecraftSwampMidMaterial;

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
  sea_floor_material: MinecraftSwampSeaFloorMaterial;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: MinecraftSwampSeaMaterial;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: MinecraftSwampTopMaterial;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


/**
 * Foundation Material (foundation_material)
 */
export interface MinecraftSwampFoundationMaterial {

}


/**
 * Mid Material (mid_material)
 */
export interface MinecraftSwampMidMaterial {

}


/**
 * Sea Floor Material (sea_floor_material)
 */
export interface MinecraftSwampSeaFloorMaterial {

}


/**
 * Sea Material (sea_material)
 */
export interface MinecraftSwampSeaMaterial {

}


/**
 * Top Material (top_material)
 */
export interface MinecraftSwampTopMaterial {

}