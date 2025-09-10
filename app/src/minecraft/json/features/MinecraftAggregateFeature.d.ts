// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:aggregate_feature
 * 
 * minecraft:aggregate_feature Samples

Example - example

"minecraft:aggregate_feature": {
  "format_version": "1.13.0",
  "minecraft:aggregate_feature": {
    "description": {
      "identifier": "example:monument_with_flowers_feature"
    },
    "features": [
      "example:monument_feature",
      "example:scatter_white_flowers_feature",
      "example:scatter_yellow_flower_feature"
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Aggregate Feature (minecraft:aggregate_feature)
 * Places a collection of features in an arbitrary order. All
 * features in the collection use the same input position. Features
 * should not depend on each other, as there is no guarantee in
 * which order the features will be placed. Succeeds if at least one
 * feature is placed successfully. Fails if all features fail to
 * be placed.
 */
export default interface MinecraftAggregateFeature {

  description: MinecraftAggregateFeatureDescription;

  /**
   * @remarks
   * Collection of features to be placed one by one. No guarantee of
   * order. All features use the same input position.
   */
  features: string[];

  format_version?: string;

}


/**
 */
export interface MinecraftAggregateFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}