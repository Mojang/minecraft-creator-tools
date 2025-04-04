// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:capped_surface
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Capped Surface (minecraft:capped_surface)
 * Generates surface on blocks with non-solid blocks above or
 * below.
 */
export default interface MinecraftCappedSurface {

  /**
   * @remarks
   * Material used to decorate surface near sea level.
   */
  beach_material: string;

  /**
   * @remarks
   * Materials used for the surface ceiling.
   */
  ceiling_materials: string;

  /**
   * @remarks
   * Materials used for the surface floor.
   */
  floor_materials: string;

  /**
   * @remarks
   * Material used to replace solid blocks that are not surface 
   * blocks.
   */
  foundation_material: string;

  /**
   * @remarks
   * Material used to replace air blocks below sea level.
   */
  sea_material: string;

}