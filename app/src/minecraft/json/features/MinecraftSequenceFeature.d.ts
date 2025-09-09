// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:sequence_feature
 * 
 * minecraft:sequence_feature Samples

Example - example

"minecraft:sequence_feature": {
  "format_version": "1.13.0",
  "minecraft:sequence_feature": {
    "description": {
      "identifier": "example:oak_tree_then_apples_feature"
    },
    "features": [
      "example:oak_tree_feature",
      "example:scatter_apples_feature"
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Sequence Feature (minecraft:sequence_feature)
 * Places a collection of features sequentially, in the order they
 * appear in data. The output position of the previous feature is
 * used as the input position for the next. For example, a tree
 * feature is placed at (0, 0, 0) and places blocks up to (0, 10,
 * 0). The next feature in the sequence begins at (0, 10, 0).
 * Succeeds if all features in the sequence are successfully placed.
 * Fails if any feature in the sequence fails to be placed. Features
 * that have not yet been placed at the time of failure are
 * skipped.
 */
export default interface MinecraftSequenceFeature {

  description: MinecraftSequenceFeatureDescription;

  /**
   * @remarks
   * List of features to be placed in sequence. The output position of
   * the previous feature is used as the input position to the 
   * next.
   */
  features: string[];

  format_version?: string;

}


/**
 */
export interface MinecraftSequenceFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}