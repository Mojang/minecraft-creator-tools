// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:material_instances
 * 
 * minecraft:material_instances Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "mikeamm_gwve_fabricator",
    "render_method": "alpha_test",
    "ambient_occlusion": 1
  }
}


Block Gray Ore - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/gray_ore.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "mikeamm_gwve_gray_ore",
    "render_method": "alpha_test",
    "face_dimming": false
  }
}


Block Frond Top - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/frond_top.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "frond_top",
    "render_method": "alpha_test"
  }
}


Block Palm Leave Corner - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_leave_corner.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "palm_leave_corner",
    "render_method": "alpha_test"
  }
}


Block Palm Leave Tip - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_leave_tip.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "palm_leave_tip",
    "render_method": "alpha_test"
  }
}


Block Palm Leave - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_leave.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "palm_leave",
    "render_method": "alpha_test"
  }
}


Block Palm Tree Top - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_tree_top.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "chill_oasis_top",
    "render_method": "alpha_test"
  }
}


Block Palm Trunk - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/palm_trunk.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "palm_trunk",
    "render_method": "alpha_test"
  }
}


Block White Sand - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/blocks/white_sand.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "white_sand",
    "render_method": "alpha_test"
  }
}


Block Leaf Pile - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/blocks/leaf_pile.block.json

"minecraft:material_instances": {
  "*": {
    "texture": "leaf_pile",
    "render_method": "alpha_test",
    "tint_method": "default_foliage"
  }
}


Tuna Roll - https://github.com/microsoft/minecraft-samples/tree/main/culled_block_sample/culled_block_behavior_pack/blocks/tuna_roll.json

"minecraft:material_instances": {
  "north": "sushi_side",
  "south": "sushi_side",
  "*": {
    "texture": "sushi_wrap"
  },
  "sushi_side": {
    "texture": "tuna_roll"
  }
}


Blue Bubble Fish - https://github.com/microsoft/minecraft-samples/tree/main/custom_blocks/behavior_packs/custom_blocks/blocks/blue_bubble_fish.json

"minecraft:material_instances": {
  "*": {
    "texture": "bubble_fish_blue",
    "render_method": "blend",
    "face_dimming": true,
    "ambient_occlusion": 1
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Material Instances (minecraft:material_instances)
 * The material instances for a block. Maps face or
 * material_instance names in a geometry file to an actual material
 * instance. You can assign a material instance object to any of
 * these faces: "up", "down", "north", "south", "east", "west", or
 * "*". You can also give an instance the name of your choosing such
 * as "my_instance", and then assign it to a face by doing
 * "north":"my_instance".
 * Note: From 1.21.80 onward, when using a minecraft:geometry component
 * or minecraft:material_instances component, you must include 
 * both.
 */
export default interface MinecraftMaterialInstances {

  down: MinecraftMaterialInstancesDown;

  east: MinecraftMaterialInstancesEast;

  /**
   * @remarks
   * A material instance definition to map to a material instance in
   * a geometry file. The material instance "*" will be used for any
   * materials that don't have a match.
   */
  MaterialInstance: MinecraftMaterialInstancesMaterialInstance[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Tuna Roll: "sushi_side"
   *
   *
   */
  north: MinecraftMaterialInstancesNorth;

  /**
   * @remarks
   * 
   * Sample Values:
   * Tuna Roll: "sushi_side"
   *
   *
   */
  south: MinecraftMaterialInstancesSouth;

  up: MinecraftMaterialInstancesUp;

  west: MinecraftMaterialInstancesWest;

}


/**
 * * (*)
 */
export interface MinecraftMaterialInstancesDown {

  /**
   * @remarks
   * If this material has ambient occlusion applied when lighting, shadows
   * will be created around and underneath the block. Decimal value
   * controls exponent applied to a value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * This material should be dimmed by the direction it's facing.
   * 
   * Sample Values:
   * Blue Bubble Fish: true
   *
   */
  face_dimming: string;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use.
   * 
   * Sample Values:
   * Blue Bubble Fish: "blend"
   *
   * Block Orange Ore: "opaque"
   *
   *
   * Block Frond Top: "alpha_test"
   *
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   * 
   * Sample Values:
   * Blue Bubble Fish: "bubble_fish_blue"
   *
   * California Roll: "sushi_wrap"
   *
   * Green Bubble Fish: "bubble_fish_green"
   *
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


export enum MinecraftMaterialInstancesDownRenderMethod {
  /**
   * @remarks
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency
   */
  Opaque = `opaque`,
  /**
   * @remarks
   * Used for completely disabling backface culling.
   */
  DoubleSided = `double_sided`,
  /**
   * @remarks
   * Used for a block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
   */
  Blend = `blend`,
  /**
   * @remarks
   * Used for a block like the monster spawner. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * disabled backface culling.
   */
  AlphaTest = `alpha_test`,
  /**
   * @remarks
   * Used for a block like the (unstained) glass. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * enables backface culling.
   */
  AlphaTestSingleSided = `alpha_test_single_sided`,
  /**
   * @remarks
   * Will blend like stained glass in the near render and turn opaque on
   * the far render.
   */
  BlendToOpaque = `blend_to_opaque`,
  /**
   * @remarks
   * Used for a block like the leaves. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * disabled backface culling.
   */
  AlphaTestToOpaque = `alpha_test_to_opaque`,
  /**
   * @remarks
   * Used for a block like the sugar cane. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * enables backface culling.
   */
  AlphaTestSingleSidedToOpaque = `alpha_test_single_sided_to_opaque`
}


/**
 * * (*)
 */
export interface MinecraftMaterialInstancesEast {

  /**
   * @remarks
   * If this material has ambient occlusion applied when lighting, shadows
   * will be created around and underneath the block. Decimal value
   * controls exponent applied to a value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * This material should be dimmed by the direction it's facing.
   * 
   * Sample Values:
   * Blue Bubble Fish: true
   *
   */
  face_dimming: string;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use.
   * 
   * Sample Values:
   * Blue Bubble Fish: "blend"
   *
   * Block Orange Ore: "opaque"
   *
   *
   * Block Frond Top: "alpha_test"
   *
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   * 
   * Sample Values:
   * Blue Bubble Fish: "bubble_fish_blue"
   *
   * California Roll: "sushi_wrap"
   *
   * Green Bubble Fish: "bubble_fish_green"
   *
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


export enum MinecraftMaterialInstancesEastRenderMethod {
  /**
   * @remarks
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency
   */
  Opaque = `opaque`,
  /**
   * @remarks
   * Used for completely disabling backface culling.
   */
  DoubleSided = `double_sided`,
  /**
   * @remarks
   * Used for a block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
   */
  Blend = `blend`,
  /**
   * @remarks
   * Used for a block like the monster spawner. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * disabled backface culling.
   */
  AlphaTest = `alpha_test`,
  /**
   * @remarks
   * Used for a block like the (unstained) glass. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * enables backface culling.
   */
  AlphaTestSingleSided = `alpha_test_single_sided`,
  /**
   * @remarks
   * Will blend like stained glass in the near render and turn opaque on
   * the far render.
   */
  BlendToOpaque = `blend_to_opaque`,
  /**
   * @remarks
   * Used for a block like the leaves. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * disabled backface culling.
   */
  AlphaTestToOpaque = `alpha_test_to_opaque`,
  /**
   * @remarks
   * Used for a block like the sugar cane. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * enables backface culling.
   */
  AlphaTestSingleSidedToOpaque = `alpha_test_single_sided_to_opaque`
}


/**
 * A material instance definition to map to a material instance in
 * a geometry file. The material instance "*" will be used for any
 * materials that don't have a match.
 */
export interface MinecraftMaterialInstancesMaterialInstance {

  /**
   * @remarks
   * Should this material have ambient occlusion applied when
   * lighting? If true, shadows will be created around and underneath the
   * block. Optionally can be constructed with float to control exponent
   * applied to ao value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * Should this material be dimmed by the direction it's facing?
   */
  face_dimming: boolean;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use. Must be one of these options:
"opaque" -
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency.
"double_sided" - Used
   * for completely disabling backface culling.
"blend" - Used for a
   * block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
"alpha_test" -
   * Used for a block like the vanilla (unstained) glass. Does not
   * allow for translucency, only fully opaque or fully transparent textures.
   * Also disables backface culling.
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


/**
 * * (*)
 */
export interface MinecraftMaterialInstancesNorth {

  /**
   * @remarks
   * If this material has ambient occlusion applied when lighting, shadows
   * will be created around and underneath the block. Decimal value
   * controls exponent applied to a value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * This material should be dimmed by the direction it's facing.
   * 
   * Sample Values:
   * Blue Bubble Fish: true
   *
   */
  face_dimming: string;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use.
   * 
   * Sample Values:
   * Blue Bubble Fish: "blend"
   *
   * Block Orange Ore: "opaque"
   *
   *
   * Block Frond Top: "alpha_test"
   *
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   * 
   * Sample Values:
   * Blue Bubble Fish: "bubble_fish_blue"
   *
   * California Roll: "sushi_wrap"
   *
   * Green Bubble Fish: "bubble_fish_green"
   *
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


export enum MinecraftMaterialInstancesNorthRenderMethod {
  /**
   * @remarks
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency
   */
  Opaque = `opaque`,
  /**
   * @remarks
   * Used for completely disabling backface culling.
   */
  DoubleSided = `double_sided`,
  /**
   * @remarks
   * Used for a block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
   */
  Blend = `blend`,
  /**
   * @remarks
   * Used for a block like the monster spawner. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * disabled backface culling.
   */
  AlphaTest = `alpha_test`,
  /**
   * @remarks
   * Used for a block like the (unstained) glass. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * enables backface culling.
   */
  AlphaTestSingleSided = `alpha_test_single_sided`,
  /**
   * @remarks
   * Will blend like stained glass in the near render and turn opaque on
   * the far render.
   */
  BlendToOpaque = `blend_to_opaque`,
  /**
   * @remarks
   * Used for a block like the leaves. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * disabled backface culling.
   */
  AlphaTestToOpaque = `alpha_test_to_opaque`,
  /**
   * @remarks
   * Used for a block like the sugar cane. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * enables backface culling.
   */
  AlphaTestSingleSidedToOpaque = `alpha_test_single_sided_to_opaque`
}


/**
 * * (*)
 */
export interface MinecraftMaterialInstancesSouth {

  /**
   * @remarks
   * If this material has ambient occlusion applied when lighting, shadows
   * will be created around and underneath the block. Decimal value
   * controls exponent applied to a value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * This material should be dimmed by the direction it's facing.
   * 
   * Sample Values:
   * Blue Bubble Fish: true
   *
   */
  face_dimming: string;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use.
   * 
   * Sample Values:
   * Blue Bubble Fish: "blend"
   *
   * Block Orange Ore: "opaque"
   *
   *
   * Block Frond Top: "alpha_test"
   *
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   * 
   * Sample Values:
   * Blue Bubble Fish: "bubble_fish_blue"
   *
   * California Roll: "sushi_wrap"
   *
   * Green Bubble Fish: "bubble_fish_green"
   *
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


export enum MinecraftMaterialInstancesSouthRenderMethod {
  /**
   * @remarks
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency
   */
  Opaque = `opaque`,
  /**
   * @remarks
   * Used for completely disabling backface culling.
   */
  DoubleSided = `double_sided`,
  /**
   * @remarks
   * Used for a block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
   */
  Blend = `blend`,
  /**
   * @remarks
   * Used for a block like the monster spawner. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * disabled backface culling.
   */
  AlphaTest = `alpha_test`,
  /**
   * @remarks
   * Used for a block like the (unstained) glass. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * enables backface culling.
   */
  AlphaTestSingleSided = `alpha_test_single_sided`,
  /**
   * @remarks
   * Will blend like stained glass in the near render and turn opaque on
   * the far render.
   */
  BlendToOpaque = `blend_to_opaque`,
  /**
   * @remarks
   * Used for a block like the leaves. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * disabled backface culling.
   */
  AlphaTestToOpaque = `alpha_test_to_opaque`,
  /**
   * @remarks
   * Used for a block like the sugar cane. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * enables backface culling.
   */
  AlphaTestSingleSidedToOpaque = `alpha_test_single_sided_to_opaque`
}


/**
 * * (*)
 */
export interface MinecraftMaterialInstancesUp {

  /**
   * @remarks
   * If this material has ambient occlusion applied when lighting, shadows
   * will be created around and underneath the block. Decimal value
   * controls exponent applied to a value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * This material should be dimmed by the direction it's facing.
   * 
   * Sample Values:
   * Blue Bubble Fish: true
   *
   */
  face_dimming: string;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use.
   * 
   * Sample Values:
   * Blue Bubble Fish: "blend"
   *
   * Block Orange Ore: "opaque"
   *
   *
   * Block Frond Top: "alpha_test"
   *
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   * 
   * Sample Values:
   * Blue Bubble Fish: "bubble_fish_blue"
   *
   * California Roll: "sushi_wrap"
   *
   * Green Bubble Fish: "bubble_fish_green"
   *
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


export enum MinecraftMaterialInstancesUpRenderMethod {
  /**
   * @remarks
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency
   */
  Opaque = `opaque`,
  /**
   * @remarks
   * Used for completely disabling backface culling.
   */
  DoubleSided = `double_sided`,
  /**
   * @remarks
   * Used for a block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
   */
  Blend = `blend`,
  /**
   * @remarks
   * Used for a block like the monster spawner. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * disabled backface culling.
   */
  AlphaTest = `alpha_test`,
  /**
   * @remarks
   * Used for a block like the (unstained) glass. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * enables backface culling.
   */
  AlphaTestSingleSided = `alpha_test_single_sided`,
  /**
   * @remarks
   * Will blend like stained glass in the near render and turn opaque on
   * the far render.
   */
  BlendToOpaque = `blend_to_opaque`,
  /**
   * @remarks
   * Used for a block like the leaves. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * disabled backface culling.
   */
  AlphaTestToOpaque = `alpha_test_to_opaque`,
  /**
   * @remarks
   * Used for a block like the sugar cane. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * enables backface culling.
   */
  AlphaTestSingleSidedToOpaque = `alpha_test_single_sided_to_opaque`
}


/**
 * * (*)
 */
export interface MinecraftMaterialInstancesWest {

  /**
   * @remarks
   * If this material has ambient occlusion applied when lighting, shadows
   * will be created around and underneath the block. Decimal value
   * controls exponent applied to a value after lighting.
   */
  ambient_occlusion: number;

  /**
   * @remarks
   * This material should be dimmed by the direction it's facing.
   * 
   * Sample Values:
   * Blue Bubble Fish: true
   *
   */
  face_dimming: string;

  /**
   * @remarks
   * Should the faces that this material is applied to randomize their
   * UVs?
   */
  isotropic: boolean;

  /**
   * @remarks
   * The render method to use.
   * 
   * Sample Values:
   * Blue Bubble Fish: "blend"
   *
   * Block Orange Ore: "opaque"
   *
   *
   * Block Frond Top: "alpha_test"
   *
   */
  render_method: string;

  /**
   * @remarks
   * Texture name for the material.
   * 
   * Sample Values:
   * Blue Bubble Fish: "bubble_fish_blue"
   *
   * California Roll: "sushi_wrap"
   *
   * Green Bubble Fish: "bubble_fish_green"
   *
   */
  texture: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint. Supported tint methods are
   * "none", "default_foliage", "birch_foliage", "evergreen_foliage", "dry_foliage",
   * "grass" and "water"
   */
  tint_method: boolean;

}


export enum MinecraftMaterialInstancesWestRenderMethod {
  /**
   * @remarks
   * Used for a regular block texture without an alpha layer. Does not
   * allow for transparency or translucency
   */
  Opaque = `opaque`,
  /**
   * @remarks
   * Used for completely disabling backface culling.
   */
  DoubleSided = `double_sided`,
  /**
   * @remarks
   * Used for a block like stained glass. Allows for transparency and
   * translucency (slightly transparent textures).
   */
  Blend = `blend`,
  /**
   * @remarks
   * Used for a block like the monster spawner. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * disabled backface culling.
   */
  AlphaTest = `alpha_test`,
  /**
   * @remarks
   * Used for a block like the (unstained) glass. Does not allow for
   * translucency, only fully opaque or fully transparent textures. Also
   * enables backface culling.
   */
  AlphaTestSingleSided = `alpha_test_single_sided`,
  /**
   * @remarks
   * Will blend like stained glass in the near render and turn opaque on
   * the far render.
   */
  BlendToOpaque = `blend_to_opaque`,
  /**
   * @remarks
   * Used for a block like the leaves. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * disabled backface culling.
   */
  AlphaTestToOpaque = `alpha_test_to_opaque`,
  /**
   * @remarks
   * Used for a block like the sugar cane. Does not allow for
   * translucency, only fully opaque or fully transparent textures in
   * the near render and turn only opaque on the far render. Also
   * enables backface culling.
   */
  AlphaTestSingleSidedToOpaque = `alpha_test_single_sided_to_opaque`
}