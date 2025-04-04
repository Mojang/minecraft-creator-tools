// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:biome_json_file
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome JSON File Biome
 * Contains a format version and a biome definition.
 */
export default interface BiomeJSONFileBiome {

  /**
   * @remarks
   * Version of the JSON schema used by this file
   */
  format_version: string;

  /**
   * @remarks
   * A single biome definition
   */
  "minecraft:biome": BiomeJSONFileBiomeMinecraftBiome;

}


/**
 * Biome Definition
 * Contains a description and components to define a Biome.
 */
export interface BiomeJSONFileBiomeMinecraftBiome {

  /**
   * @remarks
   * Components for this Biome.
   */
  components: BiomeJSONFileBiomeMinecraftBiomeComponents;

  /**
   * @remarks
   * Non-component settings, including the Biome name.
   */
  description: BiomeJSONFileBiomeMinecraftBiomeDescription;

}


/**
 * Biome Components
 * Any components that this Biome uses.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponents {

  /**
   * @remarks
   * Generates surface on blocks with non-solid blocks above or
   * below.
   */
  "minecraft:capped_surface": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftCappedSurface;

  /**
   * @remarks
   * Describes temperature, humidity, precipitation, and similar. Biomes
   * without this component will have default values.
   */
  "minecraft:climate": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftClimate;

  /**
   * @remarks
   * Probability that creatures will spawn within the biome when a
   * chunk is generated.
   */
  "minecraft:creature_spawn_probability": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftCreatureSpawnProbability;

  /**
   * @remarks
   * Similar to overworld_surface. Adds icebergs.
   */
  "minecraft:frozen_ocean_surface": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftFrozenOceanSurface;

  /**
   * @remarks
   * Similar to overworld_surface. Adds colored strata and optional
   * pillars.
   */
  "minecraft:mesa_surface": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMesaSurface;

  /**
   * @remarks
   * Noise parameters used to drive mountain terrain generation in
   * Overworld.
   */
  "minecraft:mountain_parameters": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMountainParameters;

  /**
   * @remarks
   * Controls how this biome is instantiated (and then potentially modified)
   * during world generation of the nether.
   */
  "minecraft:multinoise_generation_rules": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMultinoiseGenerationRules;

  /**
   * @remarks
   * Controls how this biome is instantiated (and then potentially modified)
   * during world generation of the overworld.
   */
  "minecraft:overworld_generation_rules": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftOverworldGenerationRules;

  /**
   * @remarks
   * Noise parameters used to drive terrain height in the 
   * Overworld.
   */
  "minecraft:overworld_height": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftOverworldHeight;

  /**
   * @remarks
   * Specify fine-detail changes to blocks used in terrain generation (based
   * on a noise function).
   */
  "minecraft:surface_material_adjustments": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustments;

  /**
   * @remarks
   * Controls the blocks used for the default Minecraft Overworld terrain
   * generation.
   */
  "minecraft:surface_parameters": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceParameters;

  /**
   * @remarks
   * Similar to overworld_surface. Adds swamp surface details.
   */
  "minecraft:swamp_surface": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSwampSurface;

  /**
   * @remarks
   * Attach arbitrary string tags to this biome.
   */
  "minecraft:tags": BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftTags;

  /**
   * @remarks
   * Use default Minecraft End terrain generation.
   */
  "minecraft:the_end_surface": object;

}


/**
 * Capped Surface
 * Generates surface on blocks with non-solid blocks above or
 * below.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftCappedSurface {

  /**
   * @remarks
   * Material used to decorate surface near sea level.
   */
  beach_material: string;

  /**
   * @remarks
   * Materials used for the surface ceiling.
   */
  ceiling_materials: string;

  /**
   * @remarks
   * Materials used for the surface floor.
   */
  floor_materials: string;

  /**
   * @remarks
   * Material used to replace solid blocks that are not surface 
   * blocks.
   */
  foundation_material: string;

  /**
   * @remarks
   * Material used to replace air blocks below sea level.
   */
  sea_material: string;

}


/**
 * Climate
 * Describes temperature, humidity, precipitation, and similar. Biomes
 * without this component will have default values.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftClimate {

  /**
   * @remarks
   * Density of ash precipitation visuals
   */
  ash: number;

  /**
   * @remarks
   * Density of blue spore precipitation visuals
   */
  blue_spores: number;

  /**
   * @remarks
   * Amount that precipitation affects colors and block changes
   */
  downfall: number;

  /**
   * @remarks
   * Density of blue spore precipitation visuals
   */
  red_spores: number;

  /**
   * @remarks
   * Minimum and maximum snow level, each multiple of 0.125 is
   * another snow layer
   */
  snow_accumulation: number[];

  /**
   * @remarks
   * Temperature affects a variety of visual and behavioral things,
   * including snow and ice placement, sponge drying, and sky 
   * color
   */
  temperature: number;

  /**
   * @remarks
   * Density of white ash precipitation visuals
   */
  white_ash: number;

}


/**
 * Creature Spawn Probability
 * Probability that creatures will spawn within the biome when a
 * chunk is generated.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftCreatureSpawnProbability {

  /**
   * @remarks
   * Probabiltity between [0.0, 0.75] of creatures spawning within the
   * biome on chunk generation.
   */
  probability: number;

}


/**
 * Frozen Ocean Surface
 * Similar to overworld_surface. Adds icebergs.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftFrozenOceanSurface {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: string;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome
   */
  mid_material: string;

  /**
   * @remarks
   * Controls how deep below the world water level the floor should
   * occur
   */
  sea_floor_depth: number;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: string;

}


/**
 * Mesa Surface
 * Similar to overworld_surface. Adds colored strata and optional
 * pillars.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMesaSurface {

  /**
   * @remarks
   * Whether the mesa generates with pillars
   */
  bryce_pillars: boolean;

  /**
   * @remarks
   * Base clay block to use
   */
  clay_material: string;

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: string;

  /**
   * @remarks
   * Hardened clay block to use
   */
  hard_clay_material: string;

  /**
   * @remarks
   * Places coarse dirt and grass at high altitudes
   */
  has_forest: boolean;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome
   */
  mid_material: string;

  /**
   * @remarks
   * Controls how deep below the world water level the floor should
   * occur
   */
  sea_floor_depth: number;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: string;

}


/**
 * Mountain Parameters
 * Noise parameters used to drive mountain terrain generation in
 * Overworld.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMountainParameters {

  /**
   * @remarks
   * Defines surface material for steep slopes
   */
  steep_material_adjustment: BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMountainParametersSteepMaterialAdjustment;

  /**
   * @remarks
   * Controls the density tapering that happens at the top of the
   * world to prevent terrain from reaching too high
   */
  top_slide: BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMountainParametersTopSlide;

}


/**
 * Mountain Parameters - Steep Material Adjustment Settings
 * Defines surface material for steep slopes.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMountainParametersSteepMaterialAdjustment {

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
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMountainParametersTopSlide {

  /**
   * @remarks
   * If false, top slide will be disabled. If true, other parameters will
   * be taken into account.
   */
  enabled: boolean;

}


/**
 * Multinoise Generation Rules
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the nether.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftMultinoiseGenerationRules {

  /**
   * @remarks
   * Altitude with which this biome should be generated, relative to
   * other biomes.
   */
  target_altitude: number;

  /**
   * @remarks
   * Humidity with which this biome should be generated, relative to
   * other biomes.
   */
  target_humidity: number;

  /**
   * @remarks
   * Temperature with which this biome should be generated, relative to
   * other biomes.
   */
  target_temperature: number;

  /**
   * @remarks
   * Weirdness with which this biome should be generated, relative to
   * other biomes.
   */
  target_weirdness: number;

  /**
   * @remarks
   * Weight with which this biome should be generated, relative to
   * other biomes.
   */
  weight: number;

}


/**
 * Overworld Generation Rules
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the overworld.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftOverworldGenerationRules {

  /**
   * @remarks
   * Controls the world generation climate categories that this biome
   * can spawn for. A single biome can be associated with multiple
   * categories with different weightings.
   */
  generate_for_climates: object[];

  /**
   * @remarks
   * What biome to switch to when converting to a hilly biome
   */
  hills_transformation: string[];

  /**
   * @remarks
   * What biome to switch to when converting to a mutated biome
   */
  mutate_transformation: string[];

  /**
   * @remarks
   * What biome to switch to when converting to a river biome (if not
   * the Vanilla 'river' biome)
   */
  river_transformation: string[];

  /**
   * @remarks
   * What biome to switch to when adjacent to an ocean biome
   */
  shore_transformation: string[];

}


/**
 * Overworld Height
 * Noise parameters used to drive terrain height in the 
 * Overworld.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftOverworldHeight {

  /**
   * @remarks
   * First value is depth - more negative means deeper underwater, while
   * more positive means higher. Second value is scale, which affects how
   * much noise changes as it moves from the surface.
   */
  noise_params: number[];

  /**
   * @remarks
   * Specifies a preset based on a built-in setting rather than
   * manually using noise_params
   */
  noise_type: string;

}


/**
 * Surface Material Adjustments
 * Specify fine-detail changes to blocks used in terrain generation (based
 * on a noise function).
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustments {

  /**
   * @remarks
   * All adjustments that match the column's noise values will be
   * applied in the order listed.
   */
  adjustments: BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustments[];

}


/**
 * Surface Material Adjustments - Surface Adjustment Settings
 * An adjustment to generated terrain, replacing blocks based on
 * the specified settings.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustments {

  /**
   * @remarks
   * Defines a range of noise values [min, max] for which this
   * adjustment should be applied.
   */
  height_range: number;

  /**
   * @remarks
   * The specific blocks used for this surface adjustment
   */
  materials: BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials;

  /**
   * @remarks
   * The scale to multiply by the position when accessing the noise
   * value for the material adjustments.
   */
  noise_frequency_scale: number;

  /**
   * @remarks
   * Defines a range of noise values [min, max] for which this
   * adjustment should be applied.
   */
  noise_range: number[];

}


/**
 * Surface Material Adjustments - Surface Adjustment Materials 
 * Settings
 * The specific blocks used for this surface adjustment.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome when
   * this adjustment is active.
   */
  foundation_material: string;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome when this adjustment is active.
   */
  mid_material: string;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome when this adjustment is active.
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used in the bodies of water in this biome
   * when this adjustment is active.
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome when
   * this adjustment is active.
   */
  top_material: string;

}


/**
 * Surface Parameters
 * Controls the blocks used for the default Minecraft Overworld terrain
 * generation.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSurfaceParameters {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: string;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: string;

  /**
   * @remarks
   * Controls how deep below the world water level the floor should
   * occur.
   */
  sea_floor_depth: number;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome.
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: string;

}


/**
 * Swamp Surface
 * Similar to overworld_surface. Adds swamp surface details.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftSwampSurface {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: string;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: string;

  /**
   * @remarks
   * Controls how deep below the world water level the floor should
   * occur.
   */
  sea_floor_depth: number;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome.
   */
  sea_floor_material: string;

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: string;

}


/**
 * Tags
 * Attach arbitrary string tags to this biome.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeComponentsMinecraftTags {

  /**
   * @remarks
   * Array of string tags used by other systems such as entity 
   * spawning
   */
  tags: string[];

}


/**
 * Biome Description
 * Contains non-component settings for a Biome.
 */
export interface BiomeJSONFileBiomeMinecraftBiomeDescription {

  /**
   * @remarks
   * The name of the Biome, used by other features like the '/locate
   * biome' command.
   */
  identifier: string;

}