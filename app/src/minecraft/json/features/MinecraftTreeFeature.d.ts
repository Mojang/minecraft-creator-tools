// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:tree_feature
 * 
 * minecraft:tree_feature Samples

Example - example

"minecraft:tree_feature": {
  "format_version": "1.13.0",
  "minecraft:tree_feature": {
    "description": {
      "identifier": "example:azalea_tree_feature"
    },
    "acacia_trunk": {
      "trunk_width": 1,
      "trunk_height": {
        "base": 4,
        "intervals": [
          2
        ],
        "min_height_for_canopy": 3
      },
      "trunk_block": {
        "name": "minecraft:log",
        "states": {
          "old_log_type": "oak"
        }
      },
      "trunk_lean": {
        "allow_diagonal_growth": true,
        "lean_height": {
          "range_min": 2,
          "range_max": 3
        },
        "lean_steps": {
          "range_min": 3,
          "range_max": 4
        },
        "lean_length": {
          "range_min": 1,
          "range_max": 2
        }
      }
    },
    "random_spread_canopy": {
      "canopy_height": 2,
      "canopy_radius": 3,
      "leaf_placement_attempts": 50,
      "leaf_blocks": [
        [
          "minecraft:azalea_leaves",
          3
        ],
        [
          "minecraft:azalea_leaves_flowered",
          1
        ]
      ]
    },
    "base_block": [
      "minecraft:dirt_with_roots"
    ],
    "may_grow_on": [
      "minecraft:dirt",
      "minecraft:grass_block",
      "minecraft:podzol",
      "minecraft:dirt",
      "minecraft:farmland",
      "minecraft:dirt_with_roots",
      "minecraft:moss_block",
      "minecraft:clay",
      "minecraft:mycelium",
      "minecraft:mud",
      "minecraft:muddy_mangrove_roots"
    ],
    "may_replace": [
      "minecraft:oak_leaves",
      "minecraft:spruce_leaves",
      "minecraft:birch_leaves",
      "minecraft:jungle_leaves",
      "minecraft:acacia_leaves",
      "minecraft:dark_oak_leaves",
      "minecraft:azalea",
      "minecraft:flowering_azalea",
      "minecraft:azalea_leaves",
      "minecraft:azalea_leaves_flowered",
      "minecraft:mangrove_leaves",
      "minecraft:water",
      "minecraft:flowing_water",
      "minecraft:moss_carpet",
      "minecraft:tallgrass",
      "minecraft:grass_block",
      "minecraft:air",
      "minecraft:sunflower",
      "minecraft:lilac",
      "minecraft:tall_grass",
      "minecraft:large_fern",
      "minecraft:rose_bush",
      "minecraft:peony"
    ],
    "may_grow_through": [
      "minecraft:dirt",
      "minecraft:grass_block",
      "minecraft:moss_carpet",
      "minecraft:tallgrass",
      "minecraft:sunflower",
      "minecraft:lilac",
      "minecraft:tall_grass",
      "minecraft:large_fern",
      "minecraft:rose_bush",
      "minecraft:peony"
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Tree Feature (minecraft:tree_feature)
 * Places a tree in the world. A tree consists of a column that is
 * anchored to a base block with set parameters for what it can be
 * placed on and canopy that extends from the column. The trunk
 * height can be randomized with a min and max value, as well as
 * the canopy offset.
 */
export default interface MinecraftTreeFeature {

  acacia_canopy: MinecraftTreeFeatureAcaciaCanopy;

  acacia_trunk: MinecraftTreeFeatureAcaciaTrunk;

  base_block: string[];

  /**
   * @remarks
   * Allows you to define a number of clusters for the base of the
   * tree. Used to generate mega tree variants.
   */
  base_cluster: MinecraftTreeFeatureBaseCluster;

  canopy: MinecraftTreeFeatureCanopy;

  cherry_canopy: MinecraftTreeFeatureCherryCanopy;

  cherry_trunk: MinecraftTreeFeatureCherryTrunk;

  description: MinecraftTreeFeatureDescription;

  fallen_trunk: MinecraftTreeFeatureFallenTrunk;

  fancy_canopy: MinecraftTreeFeatureFancyCanopy;

  fancy_trunk: MinecraftTreeFeatureFancyTrunk;

  format_version: string;

  mangrove_canopy: { [key: string]: any };

  mangrove_roots: MinecraftTreeFeatureMangroveRoots;

  mangrove_trunk: MinecraftTreeFeatureMangroveTrunk;

  may_grow_on: string[];

  may_grow_through: string[];

  may_replace: string[];

  mega_canopy: MinecraftTreeFeatureMegaCanopy;

  mega_pine_canopy: MinecraftTreeFeatureMegaPineCanopy;

  mega_trunk: MinecraftTreeFeatureMegaTrunk;

  pine_canopy: MinecraftTreeFeaturePineCanopy;

  random_spread_canopy: { [key: string]: any };

  roofed_canopy: MinecraftTreeFeatureRoofedCanopy;

  spruce_canopy: MinecraftTreeFeatureSpruceCanopy;

  trunk: MinecraftTreeFeatureTrunk;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaCanopy {

  /**
   * @remarks
   * The size of the canopy.
   */
  canopy_size: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunk {

  /**
   * @remarks
   * Configuration object for branches.
   */
  branches: MinecraftTreeFeatureAcaciaTrunkBranches;

  /**
   * @remarks
   * Configuration object for the trunk decoration.
   */
  trunk_decoration: MinecraftTreeFeatureAcaciaTrunkTrunkDecoration;

  /**
   * @remarks
   * Configuration object for the trunk height.
   */
  trunk_height: MinecraftTreeFeatureAcaciaTrunkTrunkHeight;

  /**
   * @remarks
   * Configuration object for diagonal branches.
   */
  trunk_lean: MinecraftTreeFeatureAcaciaTrunkTrunkLean;

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranches {

  /**
   * @remarks
   * Configuration object for the canopy.
   */
  branch_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopy;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopy {

  acacia_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyAcaciaCanopy;

  canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopy;

  cherry_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCherryCanopy;

  fancy_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyFancyCanopy;

  mangrove_canopy: { [key: string]: any };

  mega_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMegaCanopy;

  mega_pine_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMegaPineCanopy;

  pine_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyPineCanopy;

  roofed_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyRoofedCanopy;

  spruce_canopy: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopySpruceCanopy;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyAcaciaCanopy {

  /**
   * @remarks
   * The size of the canopy.
   */
  canopy_size: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopyCanopyDecoration;

  /**
   * @remarks
   * Canopy position offset relative to the block above the 
   * trunk.
   */
  canopy_offset: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopyCanopyOffset;

  /**
   * @remarks
   * Configuration object for the canopy slope.
   */
  canopy_slope: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopyCanopySlope;

  /**
   * @remarks
   * Min width for the canopy.
   */
  min_width: number;

  variation_chance: string[];

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopyCanopyOffset {

  /**
   * @remarks
   * Max canopy position offset.
   */
  max: number;

  /**
   * @remarks
   * Min canopy position offset.
   */
  min: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCanopyCanopySlope {

  /**
   * @remarks
   * The numerator for the slope fraction.
   */
  rise: number;

  /**
   * @remarks
   * The denominator for the slope fraction.
   */
  run: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyCherryCanopy {

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyFancyCanopy {

  /**
   * @remarks
   * Number of layers for the canopy.
   */
  height: number;

  /**
   * @remarks
   * The radius of the canopy.
   */
  radius: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMangroveCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMangroveCanopyCanopyDecoration;

  leaf_blocks: string[];

  /**
   * @remarks
   * Max number of attempts to create leaf blocks.
   */
  leaf_placement_attempts: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMangroveCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMegaCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyMegaPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopyRoofedCanopy {

  /**
   * @remarks
   * Roofed canopies feature a base and a top layer, and an extra cap
   * layer on some occasions, this value controls the number of
   * layers in the middle.
   */
  canopy_height: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * Radius used for the middle layers.
   */
  inner_radius: number;

  /**
   * @remarks
   * Radius used for the base and top layers.
   */
  outer_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkBranchesBranchCanopySpruceCanopy {

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkTrunkDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkTrunkHeight {

  /**
   * @remarks
   * Min height for the trunk.
   */
  base: number;

  intervals: string[];

  /**
   * @remarks
   * Min height where the canopy can be placed.
   */
  min_height_for_canopy: number;

}


/**
 */
export interface MinecraftTreeFeatureAcaciaTrunkTrunkLean {

  /**
   * @remarks
   * If true, diagonal branches will be created.
   */
  allow_diagonal_growth: boolean;

}


/**
 */
export interface MinecraftTreeFeatureBaseCluster {

  /**
   * @remarks
   * Radius where the clusters that can be generated.
   */
  cluster_radius: number;

  may_replace: string[];

  /**
   * @remarks
   * Number of clusters that can be generated.
   */
  num_clusters: number;

}


/**
 */
export interface MinecraftTreeFeatureCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureCanopyCanopyDecoration;

  /**
   * @remarks
   * Canopy position offset relative to the block above the 
   * trunk.
   */
  canopy_offset: MinecraftTreeFeatureCanopyCanopyOffset;

  /**
   * @remarks
   * Configuration object for the canopy slope.
   */
  canopy_slope: MinecraftTreeFeatureCanopyCanopySlope;

  /**
   * @remarks
   * Min width for the canopy.
   */
  min_width: number;

  variation_chance: string[];

}


/**
 */
export interface MinecraftTreeFeatureCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureCanopyCanopyOffset {

  /**
   * @remarks
   * Max canopy position offset.
   */
  max: number;

  /**
   * @remarks
   * Min canopy position offset.
   */
  min: number;

}


/**
 */
export interface MinecraftTreeFeatureCanopyCanopySlope {

  /**
   * @remarks
   * The numerator for the slope fraction.
   */
  rise: number;

  /**
   * @remarks
   * The denominator for the slope fraction.
   */
  run: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryCanopy {

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunk {

  /**
   * @remarks
   * Configuration object for branches.
   */
  branches: MinecraftTreeFeatureCherryTrunkBranches;

  /**
   * @remarks
   * Configuration object for the trunk height.
   */
  trunk_height: MinecraftTreeFeatureCherryTrunkTrunkHeight;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranches {

  /**
   * @remarks
   * Configuration object for the canopy.
   */
  branch_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopy;

  /**
   * @remarks
   * Configuration object to pick a tree variant based on a
   * weighted random number.
   */
  tree_type_weights: MinecraftTreeFeatureCherryTrunkBranchesTreeTypeWeights;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopy {

  acacia_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyAcaciaCanopy;

  canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopy;

  cherry_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCherryCanopy;

  fancy_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyFancyCanopy;

  mangrove_canopy: { [key: string]: any };

  mega_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMegaCanopy;

  mega_pine_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMegaPineCanopy;

  pine_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyPineCanopy;

  roofed_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyRoofedCanopy;

  spruce_canopy: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopySpruceCanopy;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyAcaciaCanopy {

  /**
   * @remarks
   * The size of the canopy.
   */
  canopy_size: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopyCanopyDecoration;

  /**
   * @remarks
   * Canopy position offset relative to the block above the 
   * trunk.
   */
  canopy_offset: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopyCanopyOffset;

  /**
   * @remarks
   * Configuration object for the canopy slope.
   */
  canopy_slope: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopyCanopySlope;

  /**
   * @remarks
   * Min width for the canopy.
   */
  min_width: number;

  variation_chance: string[];

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopyCanopyOffset {

  /**
   * @remarks
   * Max canopy position offset.
   */
  max: number;

  /**
   * @remarks
   * Min canopy position offset.
   */
  min: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCanopyCanopySlope {

  /**
   * @remarks
   * The numerator for the slope fraction.
   */
  rise: number;

  /**
   * @remarks
   * The denominator for the slope fraction.
   */
  run: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyCherryCanopy {

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyFancyCanopy {

  /**
   * @remarks
   * Number of layers for the canopy.
   */
  height: number;

  /**
   * @remarks
   * The radius of the canopy.
   */
  radius: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMangroveCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMangroveCanopyCanopyDecoration;

  leaf_blocks: string[];

  /**
   * @remarks
   * Max number of attempts to create leaf blocks.
   */
  leaf_placement_attempts: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMangroveCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMegaCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyMegaPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopyRoofedCanopy {

  /**
   * @remarks
   * Roofed canopies feature a base and a top layer, and an extra cap
   * layer on some occasions, this value controls the number of
   * layers in the middle.
   */
  canopy_height: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * Radius used for the middle layers.
   */
  inner_radius: number;

  /**
   * @remarks
   * Radius used for the base and top layers.
   */
  outer_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesBranchCanopySpruceCanopy {

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkBranchesTreeTypeWeights {

  /**
   * @remarks
   * Tree variant with one branch.
   */
  one_branch: number;

  /**
   * @remarks
   * Tree variant with two branches.
   */
  two_branches: number;

  /**
   * @remarks
   * Tree variant with three branches.
   */
  two_branches_and_trunk: number;

}


/**
 */
export interface MinecraftTreeFeatureCherryTrunkTrunkHeight {

  /**
   * @remarks
   * Min height for the trunk.
   */
  base: number;

  intervals: string[];

}


/**
 */
export interface MinecraftTreeFeatureDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}


/**
 */
export interface MinecraftTreeFeatureFallenTrunk {

  /**
   * @remarks
   * Configuration object for the trunk decoration.
   */
  trunk_decoration: MinecraftTreeFeatureFallenTrunkTrunkDecoration;

}


/**
 */
export interface MinecraftTreeFeatureFallenTrunkTrunkDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureFancyCanopy {

  /**
   * @remarks
   * Number of layers for the canopy.
   */
  height: number;

  /**
   * @remarks
   * The radius of the canopy.
   */
  radius: number;

}


/**
 */
export interface MinecraftTreeFeatureFancyTrunk {

  /**
   * @remarks
   * Configuration object for branches.
   */
  branches: MinecraftTreeFeatureFancyTrunkBranches;

  /**
   * @remarks
   * Configuration object for the trunk height.
   */
  trunk_height: MinecraftTreeFeatureFancyTrunkTrunkHeight;

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureFancyTrunkBranches {

}


/**
 */
export interface MinecraftTreeFeatureFancyTrunkTrunkHeight {

  /**
   * @remarks
   * Min height for the trunk.
   */
  base: number;

  /**
   * @remarks
   * Modifier for the trunk height.
   */
  variance: number;

}


/**
 */
export interface MinecraftTreeFeatureMangroveCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureMangroveCanopyCanopyDecoration;

  leaf_blocks: string[];

  /**
   * @remarks
   * Max number of attempts to create leaf blocks.
   */
  leaf_placement_attempts: number;

}


/**
 */
export interface MinecraftTreeFeatureMangroveCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureMangroveRoots {

  /**
   * @remarks
   * Configuration object for blocks decorating the top of the 
   * roots.
   */
  above_root: MinecraftTreeFeatureMangroveRootsAboveRoot;

  /**
   * @remarks
   * Max length for the roots.
   */
  max_root_length: number;

  /**
   * @remarks
   * Max width that the roots can occupy. The width increases up to
   * the max width while moving downwards. When a max width is
   * reached, roots will grow vertically.
   */
  max_root_width: number;

  /**
   * @remarks
   * Configuration object for the root decoration.
   */
  root_decoration: MinecraftTreeFeatureMangroveRootsRootDecoration;

  roots_may_grow_through: string[];

}


/**
 */
export interface MinecraftTreeFeatureMangroveRootsAboveRoot {

}


/**
 */
export interface MinecraftTreeFeatureMangroveRootsRootDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureMangroveTrunk {

  /**
   * @remarks
   * Configuration object for branches.
   */
  branches: MinecraftTreeFeatureMangroveTrunkBranches;

  /**
   * @remarks
   * Configuration object for the trunk decoration.
   */
  trunk_decoration: MinecraftTreeFeatureMangroveTrunkTrunkDecoration;

  /**
   * @remarks
   * Configuration object for the trunk height.
   */
  trunk_height: MinecraftTreeFeatureMangroveTrunkTrunkHeight;

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureMangroveTrunkBranches {

}


/**
 */
export interface MinecraftTreeFeatureMangroveTrunkTrunkDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureMangroveTrunkTrunkHeight {

  /**
   * @remarks
   * Min height for the trunk.
   */
  base: number;

  /**
   * @remarks
   * Tree height modifier A.
   */
  height_rand_a: number;

  /**
   * @remarks
   * Tree height modifier B.
   */
  height_rand_b: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureMegaPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunk {

  /**
   * @remarks
   * Configuration object for branches.
   */
  branches: MinecraftTreeFeatureMegaTrunkBranches;

  /**
   * @remarks
   * Configuration object for the trunk decoration.
   */
  trunk_decoration: MinecraftTreeFeatureMegaTrunkTrunkDecoration;

  /**
   * @remarks
   * Configuration object for the trunk height.
   */
  trunk_height: MinecraftTreeFeatureMegaTrunkTrunkHeight;

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranches {

  /**
   * @remarks
   * Altitude at which branches can spawn, relative to the tree
   * height.
   */
  branch_altitude_factor: MinecraftTreeFeatureMegaTrunkBranchesBranchAltitudeFactor;

  /**
   * @remarks
   * Configuration object for the canopy.
   */
  branch_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopy;

  /**
   * @remarks
   * Length for the branch.
   */
  branch_length: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchAltitudeFactor {

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopy {

  acacia_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyAcaciaCanopy;

  canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopy;

  cherry_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCherryCanopy;

  fancy_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyFancyCanopy;

  mangrove_canopy: { [key: string]: any };

  mega_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMegaCanopy;

  mega_pine_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMegaPineCanopy;

  pine_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyPineCanopy;

  roofed_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyRoofedCanopy;

  spruce_canopy: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopySpruceCanopy;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyAcaciaCanopy {

  /**
   * @remarks
   * The size of the canopy.
   */
  canopy_size: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopyCanopyDecoration;

  /**
   * @remarks
   * Canopy position offset relative to the block above the 
   * trunk.
   */
  canopy_offset: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopyCanopyOffset;

  /**
   * @remarks
   * Configuration object for the canopy slope.
   */
  canopy_slope: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopyCanopySlope;

  /**
   * @remarks
   * Min width for the canopy.
   */
  min_width: number;

  variation_chance: string[];

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopyCanopyOffset {

  /**
   * @remarks
   * Max canopy position offset.
   */
  max: number;

  /**
   * @remarks
   * Min canopy position offset.
   */
  min: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCanopyCanopySlope {

  /**
   * @remarks
   * The numerator for the slope fraction.
   */
  rise: number;

  /**
   * @remarks
   * The denominator for the slope fraction.
   */
  run: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyCherryCanopy {

  /**
   * @remarks
   * The width of the tree trunk.
   */
  trunk_width: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyFancyCanopy {

  /**
   * @remarks
   * Number of layers for the canopy.
   */
  height: number;

  /**
   * @remarks
   * The radius of the canopy.
   */
  radius: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMangroveCanopy {

  /**
   * @remarks
   * Configuration object for the canopy decoration.
   */
  canopy_decoration: MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMangroveCanopyCanopyDecoration;

  leaf_blocks: string[];

  /**
   * @remarks
   * Max number of attempts to create leaf blocks.
   */
  leaf_placement_attempts: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMangroveCanopyCanopyDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMegaCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * If true the canopy uses a simple pattern.
   */
  simplify_canopy: boolean;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyMegaPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyPineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopyRoofedCanopy {

  /**
   * @remarks
   * Roofed canopies feature a base and a top layer, and an extra cap
   * layer on some occasions, this value controls the number of
   * layers in the middle.
   */
  canopy_height: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * Radius used for the middle layers.
   */
  inner_radius: number;

  /**
   * @remarks
   * Radius used for the base and top layers.
   */
  outer_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkBranchesBranchCanopySpruceCanopy {

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkTrunkDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}


/**
 */
export interface MinecraftTreeFeatureMegaTrunkTrunkHeight {

  /**
   * @remarks
   * Min height for the trunk.
   */
  base: number;

  intervals: string[];

}


/**
 */
export interface MinecraftTreeFeaturePineCanopy {

  /**
   * @remarks
   * Radius of the canopy.
   */
  base_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureRandomSpreadCanopy {

  leaf_blocks: string[];

  /**
   * @remarks
   * Max number of attempts to create leaf blocks.
   */
  leaf_placement_attempts: number;

}


/**
 */
export interface MinecraftTreeFeatureRoofedCanopy {

  /**
   * @remarks
   * Roofed canopies feature a base and a top layer, and an extra cap
   * layer on some occasions, this value controls the number of
   * layers in the middle.
   */
  canopy_height: number;

  /**
   * @remarks
   * Width of the tree trunk.
   */
  core_width: number;

  /**
   * @remarks
   * Radius used for the middle layers.
   */
  inner_radius: number;

  /**
   * @remarks
   * Radius used for the base and top layers.
   */
  outer_radius: number;

}


/**
 */
export interface MinecraftTreeFeatureSpruceCanopy {

}


/**
 */
export interface MinecraftTreeFeatureTrunk {

  /**
   * @remarks
   * Specifies if the trunk can be submerged.
   */
  can_be_submerged: MinecraftTreeFeatureTrunkCanBeSubmerged;

  /**
   * @remarks
   * Configuration object for the trunk decoration.
   */
  trunk_decoration: MinecraftTreeFeatureTrunkTrunkDecoration;

}


/**
 */
export interface MinecraftTreeFeatureTrunkCanBeSubmerged {

  /**
   * @remarks
   * Defines the max depth at which the trunk can be submerged.
   */
  max_depth: number;

}


/**
 */
export interface MinecraftTreeFeatureTrunkTrunkDecoration {

  /**
   * @remarks
   * Number of decoration blocks to place.
   */
  num_steps: number;

  /**
   * @remarks
   * Directions to spread decoration blocks.
   */
  step_directionLessThandownupoutaway: string;

}