// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:surface_relative_threshold_feature
 * 
 * minecraft:surface_relative_threshold_feature Samples

Example - example

"minecraft:surface_relative_threshold_feature": {
  "format_version": "1.13.0",
  "minecraft:surface_relative_threshold_feature": {
    "description": {
      "identifier": "example:underwater_magma_underground_feature"
    },
    "feature_to_place": "log_decoration_feature",
    "minimum_distance_below_surface": 2
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Surface Relative Threshold Feature
 * (minecraft:surface_relative_threshold_feature)
 * Determines whether the provided position is below the estimated
 * surface level of the world, and places a feature if so. If the
 * provided position is above the configured surface or the surface is
 * not available, placement will fail. This feature only works for
 * Overworld generators using world generation 1.18 or later.
 */
export default interface MinecraftSurfaceRelativeThresholdFeature {

  description: MinecraftSurfaceRelativeThresholdFeatureDescription;

  format_version?: string;

  /**
   * @remarks
   * The minimum number of blocks required to be between the
   * estimated surface level and a valid place for this feature. Defaults
   * to zero.
   */
  minimum_distance_below_surface?: number;

}


/**
 */
export interface MinecraftSurfaceRelativeThresholdFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}