// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:swamp_surface
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Swamp Surface Biome (minecraft:swamp_surface)
 * Similar to overworld_surface. Adds swamp surface details.
 */
export default interface MinecraftSwampSurface {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: { [key: string]: string };

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
  sea_floor_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: { [key: string]: string };

}


/**
 * Foundation Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSwampSurfaceFoundationMaterial {

}


/**
 * Mid Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSwampSurfaceMidMaterial {

}


/**
 * Sea Floor Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSwampSurfaceSeaFloorMaterial {

}


/**
 * Sea Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSwampSurfaceSeaMaterial {

}


/**
 * Top Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSwampSurfaceTopMaterial {

}