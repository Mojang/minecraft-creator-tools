// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:scatter_feature
 * 
 * minecraft:scatter_feature Samples

Example - example

"minecraft:scatter_feature": {
  "format_version": "1.21.10",
  "minecraft:scatter_feature": {
    "description": {
      "identifier": "example:scatter_flowers_feature"
    },
    "places_feature": "example:flower_feature",
    "distribution": {
      "iterations": 10,
      "scatter_chance": 50,
      "x": {
        "distribution": "uniform",
        "extent": [
          0,
          15
        ]
      },
      "y": 64,
      "z": {
        "distribution": "uniform",
        "extent": [
          0,
          15
        ]
      }
    }
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Scatter Feature (minecraft:scatter_feature)
 * Scatters a feature throughout a chunk. The x, y, and z fields are
 * per-coordinate parameters. Coordinates represent an offset from
 * the input position instead of an absolute position, and may be
 * a single value, random distribution, or Molang expression that
 * resolves to a numeric value. The coordinate_eval_order field is
 * provided for finer control of coordinate resolution (particularly when
 * using the grid distribution). iterations controls how many
 * individual placements should occur if the scatter_chance check
 * succeeds. The scatter_chance check happens once, so either all
 * placements will run or none will. Succeeds if At least one
 * feature placement succeeds. Fails if all feature placements 
 * fail.
 */
export default interface MinecraftScatterFeature {

  description: MinecraftScatterFeatureDescription;

  /**
   * @remarks
   * Parameters controlling the scatter of the feature. Object of
   * type ScatterParams
   */
  distribution: object;

  format_version: string;

  /**
   * @remarks
   * If true, snaps the y-value of the scattered position to the
   * terrain heightmap. If false or unset, y-value is unmodified.
   */
  project_input_to_floor: boolean;

}


/**
 */
export interface MinecraftScatterFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}