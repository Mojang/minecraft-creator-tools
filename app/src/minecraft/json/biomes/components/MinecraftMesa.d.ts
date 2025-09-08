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
 * Biome Mesa (minecraft:mesa)
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
  clay_material: string;

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: string;

  /**
   * @remarks
   * Hardened clay block to use
   */
  hard_clay_material: string;

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
  mid_material: string;

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
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: string;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}