// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:mountain_parameters
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Mountain Parameters (minecraft:mountain_parameters)
 * Noise parameters used to drive mountain terrain generation in
 * Overworld.
 */
export default interface MinecraftMountainParameters {

  /**
   * @remarks
   * Enable for east-facing slopes
   */
  east_slopes: boolean;

  /**
   * @remarks
   * Block type use as steep material
   */
  material: MinecraftMountainParametersMaterial;

  /**
   * @remarks
   * Enable for north-facing slopes
   */
  north_slopes: boolean;

  /**
   * @remarks
   * Enable for south-facing slopes
   */
  south_slopes: boolean;

  /**
   * @remarks
   * Defines surface material for steep slopes
   */
  steep_material_adjustment: MinecraftMountainParametersSteepMaterialAdjustment;

  /**
   * @remarks
   * Controls the density tapering that happens at the top of the
   * world to prevent terrain from reaching too high
   */
  top_slide: MinecraftMountainParametersTopSlide;

  /**
   * @remarks
   * Enable for west-facing slopes
   */
  west_slopes: boolean;

}


/**
 * Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface MinecraftMountainParametersMaterial {

}


/**
 * Mountain Parameters - Steep Material Adjustment Settings
 * Defines surface material for steep slopes.
 */
export interface MinecraftMountainParametersSteepMaterialAdjustment {

  /**
   * @remarks
   * Enable for east-facing slopes
   */
  east_slopes: boolean;

  /**
   * @remarks
   * Block type use as steep material
   */
  material: string;

  /**
   * @remarks
   * Enable for north-facing slopes
   */
  north_slopes: boolean;

  /**
   * @remarks
   * Enable for south-facing slopes
   */
  south_slopes: boolean;

  /**
   * @remarks
   * Enable for west-facing slopes
   */
  west_slopes: boolean;

}


/**
 * Mountain Parameters - Top Slide Settings
 * Controls the density tapering that happens at the top of the
 * world to prevent terrain from reaching too high.
 */
export interface MinecraftMountainParametersTopSlide {

  /**
   * @remarks
   * If false, top slide will be disabled. If true, other parameters will
   * be taken into account.
   */
  enabled: boolean;

}