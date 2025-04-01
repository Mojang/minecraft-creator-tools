// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:partially_exposed_blob_feature
 * 
 * minecraft:partially_exposed_blob_feature Samples

Example - example

"minecraft:partially_exposed_blob_feature": {
  "format_version": "1.13.0",
  "minecraft:partially_exposed_blob_feature": {
    "description": {
      "identifier": "example:underwater_magma_feature"
    },
    "places_block": "minecraft:magma",
    "placement_radius_around_floor": 1,
    "placement_probability_per_valid_position": 0.5,
    "exposed_face": "up"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Partially Exposed Blob Feature
 * (minecraft:partially_exposed_blob_feature)
 * Generates a blob of the specified block with the specified dimensions.
 * For the most part, the blob is embedded in the specified surface,
 * however a single side is allowed to be exposed.
 */
export default interface MinecraftPartiallyExposedBlobFeature {

  description: MinecraftPartiallyExposedBlobFeatureDescription;

  /**
   * @remarks
   * Defines a block face that is allowed to be exposed to air and/or
   * water. Other faces need to be embedded for blocks to be placed by
   * this feature. Defaults to upwards face.
   */
  exposed_face: string;

  format_version: string;

  /**
   * @remarks
   * Defines the cubic radius of the blob. [1, 8]
   */
  placement_radius_around_floor: number;

}


/**
 */
export interface MinecraftPartiallyExposedBlobFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}