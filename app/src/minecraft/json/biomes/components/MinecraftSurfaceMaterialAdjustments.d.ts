// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:surface_material_adjustments
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Surface Material Adjustments 
 * (minecraft:surface_material_adjustments)
 * Specify fine-detail changes to blocks used in terrain generation (based
 * on a noise function).
 */
export default interface MinecraftSurfaceMaterialAdjustments {

  /**
   * @remarks
   * All adjustments that match the column's noise values will be
   * applied in the order listed.
   */
  adjustments: MinecraftSurfaceMaterialAdjustmentsAdjustments[];

  /**
   * @remarks
   * Controls the block type used deep underground in this biome when
   * this adjustment is active.
   */
  foundation_material: MinecraftSurfaceMaterialAdjustmentsFoundationMaterial;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome when this adjustment is active.
   */
  mid_material: MinecraftSurfaceMaterialAdjustmentsMidMaterial;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome when this adjustment is active.
   */
  sea_floor_material: MinecraftSurfaceMaterialAdjustmentsSeaFloorMaterial;

  /**
   * @remarks
   * Controls the block type used in the bodies of water in this biome
   * when this adjustment is active.
   */
  sea_material: MinecraftSurfaceMaterialAdjustmentsSeaMaterial;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome when
   * this adjustment is active.
   */
  top_material: MinecraftSurfaceMaterialAdjustmentsTopMaterial;

}


/**
 * Surface Material Adjustments - Surface Adjustment Settings
 * An adjustment to generated terrain, replacing blocks based on
 * the specified settings.
 */
export interface MinecraftSurfaceMaterialAdjustmentsAdjustments {

  /**
   * @remarks
   * Defines a range of noise values [min, max] for which this
   * adjustment should be applied.
   */
  height_range: number;

  /**
   * @remarks
   * The specific blocks used for this surface adjustment
   */
  materials: MinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials;

  /**
   * @remarks
   * The scale to multiply by the position when accessing the noise
   * value for the material adjustments.
   */
  noise_frequency_scale: number;

  /**
   * @remarks
   * Defines a range of noise values [min, max] for which this
   * adjustment should be applied.
   */
  noise_range: number[];

}


/**
 * Surface Material Adjustments - Surface Adjustment Materials 
 * Settings
 * The specific blocks used for this surface adjustment.
 */
export interface MinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome when
   * this adjustment is active.
   */
  foundation_material: string;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome when this adjustment is active.
   */
  mid_material: string;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome when this adjustment is active.
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used in the bodies of water in this biome
   * when this adjustment is active.
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome when
   * this adjustment is active.
   */
  top_material: string;

}


/**
 * Foundation Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSurfaceMaterialAdjustmentsFoundationMaterial {

}


/**
 * Mid Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSurfaceMaterialAdjustmentsMidMaterial {

}


/**
 * Sea Floor Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSurfaceMaterialAdjustmentsSeaFloorMaterial {

}


/**
 * Sea Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSurfaceMaterialAdjustmentsSeaMaterial {

}


/**
 * Top Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftSurfaceMaterialAdjustmentsTopMaterial {

}