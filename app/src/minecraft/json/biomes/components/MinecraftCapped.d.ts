// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:capped
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Capped Biome (minecraft:capped)
 * Generates surface on blocks with non-solid blocks above or
 * below.
 */
export default interface MinecraftCapped {

  /**
   * @remarks
   * Material used to decorate surface near sea level.
   */
  beach_material: MinecraftCappedBeachMaterial;

  /**
   * @remarks
   * Materials used for the surface ceiling.
   */
  ceiling_materials: MinecraftCappedCeilingMaterials[];

  /**
   * @remarks
   * Materials used for the surface floor.
   */
  floor_materials: MinecraftCappedFloorMaterials[];

  /**
   * @remarks
   * Material used to replace solid blocks that are not surface 
   * blocks.
   */
  foundation_material: MinecraftCappedFoundationMaterial;

  /**
   * @remarks
   * Material used to replace air blocks below sea level.
   */
  sea_material: MinecraftCappedSeaMaterial;

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


/**
 * Beach Material (beach_material)
 */
export interface MinecraftCappedBeachMaterial {

}


/**
 * Ceiling Materials (ceiling_materials)
 */
export interface MinecraftCappedCeilingMaterials {

}


/**
 * Floor Materials (floor_materials)
 */
export interface MinecraftCappedFloorMaterials {

}


/**
 * Foundation Material (foundation_material)
 */
export interface MinecraftCappedFoundationMaterial {

}


/**
 * Sea Material (sea_material)
 */
export interface MinecraftCappedSeaMaterial {

}