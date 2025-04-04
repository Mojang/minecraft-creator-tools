// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:structure_template_feature
 * 
 * minecraft:structure_template_feature Samples

Example - example

"minecraft:structure_template_feature": {
  "format_version": "1.13.0",
  "minecraft:aggregate_feature": {
    "format_version": "1.13.0",
    "minecraft:structure_template_feature": {
      "description": {
        "identifier": "example:hot_air_balloon_feature"
      },
      "structure_name": "example:hot_air_balloon",
      "adjustment_radius": 8,
      "facing_direction": "random",
      "constraints": {
        "unburied": {},
        "block_intersection": {
          "block_allowlist": [
            "minecraft:air"
          ]
        }
      }
    }
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Structure Template Feature 
 * (minecraft:structure_template_feature)
 * Places a structure in the world. The structure must be stored as
 * a .mcstructure file in the `structures` subdirectory of a
 * behavior pack. It is possible to reference structures that are
 * part of other behavior packs, they do not need to come from the
 * same behavior pack as this feature. Constraints can be defined to
 * specify where the structure is allowed to be placed. During
 * placement, the feature will search for a position within the
 * adjustment_radius that satisfies all constraints. If none are
 * found, the structure will not be placed. Succeeds if the
 * structure is placed in the world. Fails if the structure fails to
 * be placed within the world.
 */
export default interface MinecraftStructureTemplateFeature {

  /**
   * @remarks
   * How far the structure is allowed to move when searching for a
   * valid placement position. Search is radial, stopping when the
   * nearest valid position is found. Defaults to 0 if omitted.
   */
  adjustment_radius: number;

  /**
   * @remarks
   * Specific constraints that must be satisfied when placing this
   * structure.
   */
  constraints: MinecraftStructureTemplateFeatureConstraints;

  description: MinecraftStructureTemplateFeatureDescription;

  /**
   * @remarks
   * Direction the structure will face when placed in the world.
   * Defaults to "random" if omitted.
   */
  facing_directionLessThannorthsoutheastwestrandom: string;

  format_version: string;

}


/**
 */
export interface MinecraftStructureTemplateFeatureConstraints {

  /**
   * @remarks
   * When specified, ensures the structure only intersects with
   * allowlisted blocks.
   */
  block_intersection: MinecraftStructureTemplateFeatureConstraintsBlockIntersection;

  /**
   * @remarks
   * When specified, ensures the structure is on the ground.
   */
  grounded: object;

  /**
   * @remarks
   * When specified, ensures the structure has air above it.
   */
  unburied: object;

}


/**
 */
export interface MinecraftStructureTemplateFeatureConstraintsBlockIntersection {

  block_allowlistblock_whitelist: string[];

}


/**
 */
export interface MinecraftStructureTemplateFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}