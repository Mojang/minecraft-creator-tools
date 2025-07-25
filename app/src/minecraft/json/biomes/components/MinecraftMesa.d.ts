// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:mesa
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Mesa Biome (minecraft:mesa)
 * Similar to overworld_surface. Adds colored strata and optional
 * pillars.
 */
export default interface MinecraftMesa {

  /**
   * @remarks
   * Whether the mesa generates with pillars
   */
  bryce_pillars: boolean;

  /**
   * @remarks
   * Base clay block to use
   */
  clay_material: MinecraftMesaClayMaterial;

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: MinecraftMesaFoundationMaterial;

  /**
   * @remarks
   * Hardened clay block to use
   */
  hard_clay_material: MinecraftMesaHardClayMaterial;

  /**
   * @remarks
   * Places coarse dirt and grass at high altitudes
   */
  has_forest: boolean;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome
   */
  mid_material: MinecraftMesaMidMaterial;

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
  sea_floor_material: MinecraftMesaSeaFloorMaterial;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: MinecraftMesaSeaMaterial;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: MinecraftMesaTopMaterial;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


/**
 * Clay Material (clay_material)
 */
export interface MinecraftMesaClayMaterial {

}


/**
 * Foundation Material (foundation_material)
 */
export interface MinecraftMesaFoundationMaterial {

}


/**
 * Hard Clay Material (hard_clay_material)
 */
export interface MinecraftMesaHardClayMaterial {

}


/**
 * Mid Material (mid_material)
 */
export interface MinecraftMesaMidMaterial {

}


/**
 * Sea Floor Material (sea_floor_material)
 */
export interface MinecraftMesaSeaFloorMaterial {

}


/**
 * Sea Material (sea_material)
 */
export interface MinecraftMesaSeaMaterial {

}


/**
 * Top Material (top_material)
 */
export interface MinecraftMesaTopMaterial {

}