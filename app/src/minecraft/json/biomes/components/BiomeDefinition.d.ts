// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Biome Documentation - minecraft:biome_definition
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Biome Definition Biome (Biome Definition)
 * Contains a description and components to define a Biome.
 */
export default interface BiomeDefinition {

  /**
   * @remarks
   * Components for this Biome.
   */
  components: BiomeDefinitionComponents;

  /**
   * @remarks
   * Non-component settings, including the Biome name.
   */
  description: BiomeDefinitionDescription;

}


/**
 * Biome Components (Biome Components)
 * Any components that this Biome uses.
 */
export interface BiomeDefinitionComponents {

  /**
   * @remarks
   * Generates surface on blocks with non-solid blocks above or
   * below.
   */
  "minecraft:capped_surface": BiomeDefinitionComponentsMinecraftCappedSurface;

  /**
   * @remarks
   * Describes temperature, humidity, precipitation, and similar. Biomes
   * without this component will have default values.
   */
  "minecraft:climate": BiomeDefinitionComponentsMinecraftClimate;

  /**
   * @remarks
   * Probability that creatures will spawn within the biome when a
   * chunk is generated.
   */
  "minecraft:creature_spawn_probability": BiomeDefinitionComponentsMinecraftCreatureSpawnProbability;

  /**
   * @remarks
   * Similar to overworld_surface. Adds icebergs.
   */
  "minecraft:frozen_ocean_surface": BiomeDefinitionComponentsMinecraftFrozenOceanSurface;

  /**
   * @remarks
   * Similar to overworld_surface. Adds colored strata and optional
   * pillars.
   */
  "minecraft:mesa_surface": BiomeDefinitionComponentsMinecraftMesaSurface;

  /**
   * @remarks
   * Noise parameters used to drive mountain terrain generation in
   * Overworld.
   */
  "minecraft:mountain_parameters": BiomeDefinitionComponentsMinecraftMountainParameters;

  /**
   * @remarks
   * Controls how this biome is instantiated (and then potentially modified)
   * during world generation of the nether.
   */
  "minecraft:multinoise_generation_rules": BiomeDefinitionComponentsMinecraftMultinoiseGenerationRules;

  /**
   * @remarks
   * Controls how this biome is instantiated (and then potentially modified)
   * during world generation of the overworld.
   */
  "minecraft:overworld_generation_rules": BiomeDefinitionComponentsMinecraftOverworldGenerationRules;

  /**
   * @remarks
   * Noise parameters used to drive terrain height in the 
   * Overworld.
   */
  "minecraft:overworld_height": BiomeDefinitionComponentsMinecraftOverworldHeight;

  /**
   * @remarks
   * Replaces a specified portion of one or more Minecraft 
   * biomes.
   */
  "minecraft:replace_biomes": BiomeDefinitionComponentsMinecraftReplaceBiomes;

  /**
   * @remarks
   * Specify fine-detail changes to blocks used in terrain generation (based
   * on a noise function).
   */
  "minecraft:surface_material_adjustments": BiomeDefinitionComponentsMinecraftSurfaceMaterialAdjustments;

  /**
   * @remarks
   * Controls the blocks used for the default Minecraft Overworld terrain
   * generation.
   */
  "minecraft:surface_parameters": BiomeDefinitionComponentsMinecraftSurfaceParameters;

  /**
   * @remarks
   * Similar to overworld_surface. Adds swamp surface details.
   */
  "minecraft:swamp_surface": BiomeDefinitionComponentsMinecraftSwampSurface;

  /**
   * @remarks
   * 
Attach arbitrary string tags to this biome.
Most biome tags are
   * referenced by JSON settings, but some meanings of tags are
   * directly implemented in the game's code. These tags are listed
   * here:
birch: Biome uses wildflowers (mutually exclusive with
   * other flower biome tags). Does nothing if biome is tagged
   * "hills".
cold: Villagers will be dressed for snowy weather.
deep: Pre-Caves
   * and Cliffs, prevents an ocean from having islands or connected rivers
   * and makes the biome less likely to have hills.
desert: Allows
   * partially-buried ruined portals to be placed in the biome. Sand
   * blocks will play ambient sounds when the player is
   * nearby.
extreme_hills: Ruined portals can be placed higher than
   * normal. Biomes tagged "forest" or "forest_generation" will use
   * normal Overworld flowers instead of forest flowers.
flower_forest: Biome
   * uses forest flowers (mutually exclusive with other flower biome
   * tags).
forest: Biome uses forest flowers (mutually exclusive with
   * other flower biome tags). Does nothing if biome is tagged tagged
   * "taiga" or "extreme_hills".
forest_generation: Equivalent to
   * "forest".
frozen: Villagers will be dressed for snowy weather.
   * Prevents the biome from containing lava springs if it is also
   * tagged "ocean".
ice: Around ruined portals, lava is always replaced
   * by Netherrack and Netherrack cannot be replaced by
   * magma.
ice_plains: Prevents the biome from containing lava
   * springs if it is also tagged "mutated".
jungle: Ruined portals will
   * be very mossy.
hills: Biomes tagged "meadow" or "birch" will use
   * normal Overworld flowers instead of wildflowers.
meadow: Biome
   * uses wildflowers (mutually exclusive with other flower biome
   * tags). Does nothing if biome is tagged "hills".
mesa: Sand blocks
   * will play ambient sounds when the player is nearby.
mountain: Ruined
   * portals can be placed higher than normal.
mutated: Pre-Caves and
   * Cliffs, prevents switching to the specified "mutate_transformation" as
   * the biome is already considered mutated. Prevents the biome from
   * containing lava springs if it is also tagged
   * "ice_plains".
no_legacy_worldgen: Prevents biome from using legacy
   * world generation behavior unless the biome is being placed in
   * the Overworld.
ocean: Prevents the biome from containing lava
   * springs if it is also tagged "frozen". Allows ruined portals to
   * be found underwater. Pre-Caves and Cliffs, determines if
   * shorelines and rivers should be placed at the edges of the biome
   * and identifies the biome as a shallow ocean for placing islands,
   * unless the "deep" tag is present.
pale_garden: Biome uses
   * closed-eye blossoms (mutually exclusive with other flower biome
   * tags).
plains: Biome uses plains flowers (mutually exclusive with
   * other flower biome tags).
rare: Pre-Caves and Cliffs, this tag
   * flags the biome as a special biome. Oceans cannot be
   * special.
swamp: Allows ruined portals to be found underwater. Biome
   * uses swamp flowers (mutually exclusive with other flower biome
   * tags).
taiga: Biomes tagged "forest" or "forest_generation" will
   * use normal Overworld flowers instead of forest flowers.

   */
  "minecraft:tags": BiomeDefinitionComponentsMinecraftTags;

  /**
   * @remarks
   * Use default Minecraft End terrain generation.
   */
  "minecraft:the_end_surface": object;

}


/**
 * Capped Surface (minecraft:capped_surface)
 * Generates surface on blocks with non-solid blocks above or
 * below.
 */
export interface BiomeDefinitionComponentsMinecraftCappedSurface {

  /**
   * @remarks
   * Material used to decorate surface near sea level.
   */
  beach_material: { [key: string]: string };

  /**
   * @remarks
   * Materials used for the surface ceiling.
   */
  ceiling_materials: { [key: string]: string };

  /**
   * @remarks
   * Materials used for the surface floor.
   */
  floor_materials: { [key: string]: string };

  /**
   * @remarks
   * Material used to replace solid blocks that are not surface 
   * blocks.
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Material used to replace air blocks below sea level.
   */
  sea_material: { [key: string]: string };

}


/**
 * Climate (minecraft:climate)
 * Describes temperature, humidity, precipitation, and similar. Biomes
 * without this component will have default values.
 */
export interface BiomeDefinitionComponentsMinecraftClimate {

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
 * (minecraft:creature_spawn_probability)
 * Probability that creatures will spawn within the biome when a
 * chunk is generated.
 */
export interface BiomeDefinitionComponentsMinecraftCreatureSpawnProbability {

  /**
   * @remarks
   * Probabiltity between [0.0, 0.75] of creatures spawning within the
   * biome on chunk generation.
   */
  probability: number;

}


/**
 * Frozen Ocean Surface (minecraft:frozen_ocean_surface)
 * Similar to overworld_surface. Adds icebergs.
 */
export interface BiomeDefinitionComponentsMinecraftFrozenOceanSurface {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome
   */
  mid_material: { [key: string]: string };

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
  sea_floor_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: { [key: string]: string };

}


/**
 * Mesa Surface (minecraft:mesa_surface)
 * Similar to overworld_surface. Adds colored strata and optional
 * pillars.
 */
export interface BiomeDefinitionComponentsMinecraftMesaSurface {

  /**
   * @remarks
   * Whether the mesa generates with pillars
   */
  bryce_pillars: boolean;

  /**
   * @remarks
   * Base clay block to use
   */
  clay_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used deep underground in this biome
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Hardened clay block to use
   */
  hard_clay_material: { [key: string]: string };

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
  mid_material: { [key: string]: string };

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
  sea_floor_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome
   */
  sea_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the surface of this biome
   */
  top_material: { [key: string]: string };

}


/**
 * Mountain Parameters (minecraft:mountain_parameters)
 * Noise parameters used to drive mountain terrain generation in
 * Overworld.
 */
export interface BiomeDefinitionComponentsMinecraftMountainParameters {

  /**
   * @remarks
   * Defines surface material for steep slopes
   */
  steep_material_adjustment: BiomeDefinitionComponentsMinecraftMountainParametersSteepMaterialAdjustment;

  /**
   * @remarks
   * Controls the density tapering that happens at the top of the
   * world to prevent terrain from reaching too high
   */
  top_slide: BiomeDefinitionComponentsMinecraftMountainParametersTopSlide;

}


/**
 * Mountain Parameters - Steep Material Adjustment Settings
 * (minecraft:mountain_parameters - steep_material_adjustment 
 * settings)
 * Defines surface material for steep slopes.
 */
export interface BiomeDefinitionComponentsMinecraftMountainParametersSteepMaterialAdjustment {

  /**
   * @remarks
   * Enable for east-facing slopes
   */
  east_slopes: boolean;

  /**
   * @remarks
   * Block type use as steep material
   */
  material: { [key: string]: string };

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
 * (minecraft:mountain_parameters - top_slide settings)
 * Controls the density tapering that happens at the top of the
 * world to prevent terrain from reaching too high.
 */
export interface BiomeDefinitionComponentsMinecraftMountainParametersTopSlide {

  /**
   * @remarks
   * If false, top slide will be disabled. If true, other parameters will
   * be taken into account.
   */
  enabled: boolean;

}


/**
 * Multinoise Generation Rules
 * (minecraft:multinoise_generation_rules)
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the nether.
 */
export interface BiomeDefinitionComponentsMinecraftMultinoiseGenerationRules {

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
 * (minecraft:overworld_generation_rules)
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the overworld.
 */
export interface BiomeDefinitionComponentsMinecraftOverworldGenerationRules {

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
 * Overworld Height (minecraft:overworld_height)
 * Noise parameters used to drive terrain height in the 
 * Overworld.
 */
export interface BiomeDefinitionComponentsMinecraftOverworldHeight {

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
 * Replace Biomes (minecraft:replace_biomes)
 * Replaces a specified portion of one or more Minecraft 
 * biomes.
 */
export interface BiomeDefinitionComponentsMinecraftReplaceBiomes {

  /**
   * @remarks
   * List of biome replacement configurations. Retroactively adding a
   * new replacement to the front of this list will cause the world
   * generation to change. Please add any new replacements to the end
   * of the list.
   */
  replacements: BiomeDefinitionComponentsMinecraftReplaceBiomesReplacements[];

}


/**
 * Biome Replacement (Biome Replacement)
 * Represents the replacement information used to determine the
 * placement of the overriding biome.
 */
export interface BiomeDefinitionComponentsMinecraftReplaceBiomesReplacements {

  /**
   * @remarks
   * Noise value used to determine whether or not the replacement is
   * attempted, similar to a percentage. Must be in the range (0.0,
   * 1.0].
   */
  amount: number;

  /**
   * @remarks
   * Dimension in which this replacement can happen. Must be
   * 'minecraft:overworld'.
   */
  dimension: string;

  /**
   * @remarks
   * Scaling value used to alter the frequency of replacement attempts. A
   * lower frequency will mean a bigger contiguous biome area that
   * occurs less often. A higher frequency will mean smaller contiguous
   * biome areas that occur more often. Must be in the range (0.0,
   * 100.0].
   */
  noise_frequency_scale: number;

  /**
   * @remarks
   * Biomes that are going to be replaced by the overriding biome.
   * Target biomes must not contain namespaces.
   */
  targets: { [key: string]: string };

}


/**
 * Surface Material Adjustments 
 * (minecraft:surface_material_adjustments)
 * Specify fine-detail changes to blocks used in terrain generation (based
 * on a noise function).
 */
export interface BiomeDefinitionComponentsMinecraftSurfaceMaterialAdjustments {

  /**
   * @remarks
   * All adjustments that match the column's noise values will be
   * applied in the order listed.
   */
  adjustments: BiomeDefinitionComponentsMinecraftSurfaceMaterialAdjustmentsAdjustments[];

}


/**
 * Surface Material Adjustments - Surface Adjustment Settings
 * (minecraft:surface_material_adjustments - surface adjustment 
 * settings)
 * An adjustment to generated terrain, replacing blocks based on
 * the specified settings.
 */
export interface BiomeDefinitionComponentsMinecraftSurfaceMaterialAdjustmentsAdjustments {

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
  materials: BiomeDefinitionComponentsMinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials;

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
 * Surface Material Adjustments - Surface Adjustment Materials Settings
 * (minecraft:surface_material_adjustments - surface adjustment materials
 * settings)
 * The specific blocks used for this surface adjustment.
 */
export interface BiomeDefinitionComponentsMinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome when
   * this adjustment is active.
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome when this adjustment is active.
   */
  mid_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome when this adjustment is active.
   */
  sea_floor_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used in the bodies of water in this biome
   * when this adjustment is active.
   */
  sea_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the surface of this biome when
   * this adjustment is active.
   */
  top_material: { [key: string]: string };

}


/**
 * Surface Parameters (minecraft:surface_parameters)
 * Controls the blocks used for the default Minecraft Overworld terrain
 * generation.
 */
export interface BiomeDefinitionComponentsMinecraftSurfaceParameters {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: { [key: string]: string };

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
  sea_floor_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: { [key: string]: string };

}


/**
 * Swamp Surface (minecraft:swamp_surface)
 * Similar to overworld_surface. Adds swamp surface details.
 */
export interface BiomeDefinitionComponentsMinecraftSwampSurface {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome.
   */
  foundation_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome.
   */
  mid_material: { [key: string]: string };

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
  sea_floor_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the bodies of water in this
   * biome.
   */
  sea_material: { [key: string]: string };

  /**
   * @remarks
   * Controls the block type used for the surface of this biome.
   */
  top_material: { [key: string]: string };

}


/**
 * Tags (minecraft:tags)
 * Attach arbitrary string tags to this biome.
Most biome tags are
 * referenced by JSON settings, but some meanings of tags are
 * directly implemented in the game's code. These tags are listed
 * here:
birch: Biome uses wildflowers (mutually exclusive with
 * other flower biome tags). Does nothing if biome is tagged
 * "hills".
cold: Villagers will be dressed for snowy weather.
deep: Pre-Caves
 * and Cliffs, prevents an ocean from having islands or connected rivers
 * and makes the biome less likely to have hills.
desert: Allows
 * partially-buried ruined portals to be placed in the biome. Sand
 * blocks will play ambient sounds when the player is
 * nearby.
extreme_hills: Ruined portals can be placed higher than
 * normal. Biomes tagged "forest" or "forest_generation" will use
 * normal Overworld flowers instead of forest flowers.
flower_forest: Biome
 * uses forest flowers (mutually exclusive with other flower biome
 * tags).
forest: Biome uses forest flowers (mutually exclusive with
 * other flower biome tags). Does nothing if biome is tagged tagged
 * "taiga" or "extreme_hills".
forest_generation: Equivalent to
 * "forest".
frozen: Villagers will be dressed for snowy weather.
 * Prevents the biome from containing lava springs if it is also
 * tagged "ocean".
ice: Around ruined portals, lava is always replaced
 * by Netherrack and Netherrack cannot be replaced by
 * magma.
ice_plains: Prevents the biome from containing lava
 * springs if it is also tagged "mutated".
jungle: Ruined portals will
 * be very mossy.
hills: Biomes tagged "meadow" or "birch" will use
 * normal Overworld flowers instead of wildflowers.
meadow: Biome
 * uses wildflowers (mutually exclusive with other flower biome
 * tags). Does nothing if biome is tagged "hills".
mesa: Sand blocks
 * will play ambient sounds when the player is nearby.
mountain: Ruined
 * portals can be placed higher than normal.
mutated: Pre-Caves and
 * Cliffs, prevents switching to the specified "mutate_transformation" as
 * the biome is already considered mutated. Prevents the biome from
 * containing lava springs if it is also tagged
 * "ice_plains".
no_legacy_worldgen: Prevents biome from using legacy
 * world generation behavior unless the biome is being placed in
 * the Overworld.
ocean: Prevents the biome from containing lava
 * springs if it is also tagged "frozen". Allows ruined portals to
 * be found underwater. Pre-Caves and Cliffs, determines if
 * shorelines and rivers should be placed at the edges of the biome
 * and identifies the biome as a shallow ocean for placing islands,
 * unless the "deep" tag is present.
pale_garden: Biome uses
 * closed-eye blossoms (mutually exclusive with other flower biome
 * tags).
plains: Biome uses plains flowers (mutually exclusive with
 * other flower biome tags).
rare: Pre-Caves and Cliffs, this tag
 * flags the biome as a special biome. Oceans cannot be
 * special.
swamp: Allows ruined portals to be found underwater. Biome
 * uses swamp flowers (mutually exclusive with other flower biome
 * tags).
taiga: Biomes tagged "forest" or "forest_generation" will
 * use normal Overworld flowers instead of forest flowers.
 */
export interface BiomeDefinitionComponentsMinecraftTags {

  /**
   * @remarks
   * Array of string tags used by other systems such as entity 
   * spawning
   */
  tags: string[];

}


/**
 * Biome Description (Biome Description)
 * Contains non-component settings for a Biome.
 */
export interface BiomeDefinitionDescription {

  /**
   * @remarks
   * The name of the Biome, used by other features like the '/locate
   * biome' command. Identifiers should only be lowercase.
   */
  identifier: object;

}