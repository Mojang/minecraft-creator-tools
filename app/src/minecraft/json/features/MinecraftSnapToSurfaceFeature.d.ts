// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:snap_to_surface_feature
 * 
 * minecraft:snap_to_surface_feature Samples

Example - example

"minecraft:snap_to_surface_feature": {
  "format_version": "1.13.0",
  "minecraft:snap_to_surface_feature": {
    "description": {
      "identifier": "example:cave_vine_snapped_to_ceiling_feature"
    },
    "feature_to_snap": "example:cave_vine_feature",
    "vertical_search_range": 12,
    "surface": "ceiling",
    "allowed_surface_blocks": {
      "name": "minecraft:cobblestone"
    }
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Snap To Surface Feature (minecraft:snap_to_surface_feature)
 * Snaps the y-value of a feature placement pos to the floor or
 * the ceiling within the provided vertical_search_range. The
 * placement biome is preserved. If the snap position goes outside of
 * the placement biome, placement will fail.
 */
export default interface MinecraftSnapToSurfaceFeature {

  /**
   * @remarks
   * Determines whether the feature can snap through air blocks. Defaults
   * to true.
   */
  allow_air_placement?: boolean;

  /**
   * @remarks
   * Determines whether the feature can snap through water blocks.
   * Defaults to false.
   */
  allow_underwater_placement?: boolean;

  /**
   * @remarks
   * A list of blocks that the feature is permitted to snap to.
   * Leaving this empty results in the feature snapping to blocks that
   * can provide support for the given face (up/down/horizontal)
   */
  allowed_surface_blocks?: string[];

  description: MinecraftSnapToSurfaceFeatureDescription;

  format_version?: string;

  /**
   * @remarks
   * Defines the surface that the y-value of the placement position will
   * be snapped to. Valid values: 'ceiling', 'floor' and
   * 'random_horizontal'
   */
  surface?: string;

  /**
   * @remarks
   * Range to search for a floor or ceiling for snaping the 
   * feature.
   */
  vertical_search_range: number;

}


/**
 */
export interface MinecraftSnapToSurfaceFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}