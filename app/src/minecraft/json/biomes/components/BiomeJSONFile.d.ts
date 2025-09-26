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
 * Biome JSON File (Biome JSON File)
 * Contains a format version and a biome definition.
 */
export default interface BiomeJSONFile {

  /**
   * @remarks
   * Version of the JSON schema used by this file
   */
  format_version: string;

  /**
   * @remarks
   * A single biome definition
   */
  "minecraft:biome": BiomeJSONFileMinecraftBiome;

}


/**
 * Biome Definition (Biome Definition)
 * Contains a description and components to define a Biome.
 */
export interface BiomeJSONFileMinecraftBiome {

  /**
   * @remarks
   * Components for this Biome.
   */
  components: BiomeJSONFileMinecraftBiomeComponents;

  /**
   * @remarks
   * Non-component settings, including the Biome name.
   */
  description: BiomeJSONFileMinecraftBiomeDescription;

}


/**
 * Biome Components (Biome Components)
 * Any components that this Biome uses.
 */
export interface BiomeJSONFileMinecraftBiomeComponents {

  /**
   * @remarks
   * Describes temperature, humidity, precipitation, and similar. Biomes
   * without this component will have default values.
   */
  "minecraft:climate"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftClimate;

  /**
   * @remarks
   * Probability that creatures will spawn within the biome when a
   * chunk is generated.
   */
  "minecraft:creature_spawn_probability"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftCreatureSpawnProbability;

  /**
   * @remarks
   * Forces a biome to ether always be humid or never humid. Humidity
   * effects the spread chance, and spread rate of fire in the 
   * biome
   */
  "minecraft:humidity"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftHumidity;

  /**
   * @remarks
   * Sets the color grass and foliage will be tinted by in this biome
   * on the map.
   */
  "minecraft:map_tints"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftMapTints;

  /**
   * @remarks
   * Noise parameters used to drive mountain terrain generation in
   * Overworld.
   */
  "minecraft:mountain_parameters"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParameters;

  /**
   * @remarks
   * Controls how this biome is instantiated (and then potentially modified)
   * during world generation of the nether.
   */
  "minecraft:multinoise_generation_rules"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftMultinoiseGenerationRules;

  /**
   * @remarks
   * Controls how this biome is instantiated (and then potentially modified)
   * during world generation of the overworld.
   */
  "minecraft:overworld_generation_rules"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftOverworldGenerationRules;

  /**
   * @remarks
   * Noise parameters used to drive terrain height in the 
   * Overworld.
   */
  "minecraft:overworld_height"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftOverworldHeight;

  /**
   * @remarks
   * Component will impact the temperature in a frozen biome, causing
   * some areas to not be frozen. Ex: patchy ice, patchy snow
   */
  "minecraft:partially_frozen"?: object;

  /**
   * @remarks
   * Replaces a specified portion of one or more Minecraft 
   * biomes.
   */
  "minecraft:replace_biomes"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftReplaceBiomes;

  /**
   * @remarks
   * Controls the materials used for terrain generation.
   */
  "minecraft:surface_builder"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceBuilder;

  /**
   * @remarks
   * Specify fine-detail changes to blocks used in terrain generation (based
   * on a noise function).
   */
  "minecraft:surface_material_adjustments"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustments;

  /**
   * @remarks
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
  "minecraft:tags"?: BiomeJSONFileMinecraftBiomeComponentsMinecraftTags;

}


/**
 * Biome Climate (minecraft:climate)
 * Describes temperature, humidity, precipitation, and similar. Biomes
 * without this component will have default values.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftClimate {

  /**
   * @remarks
   * Amount that precipitation affects colors and block changes. Setting
   * to 0 will stop rain from falling in the biome.
   */
  downfall?: number;

  /**
   * @remarks
   * Minimum and maximum snow level, each multiple of 0.125 is
   * another snow layer
   */
  snow_accumulation?: number[];

  /**
   * @remarks
   * Temperature affects a variety of visual and behavioral things,
   * including snow and ice placement, sponge drying, and sky 
   * color
   */
  temperature?: number;

}


/**
 * Biome Creature Spawn Probability 
 * (minecraft:creature_spawn_probability)
 * Probability that creatures will spawn within the biome when a
 * chunk is generated.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftCreatureSpawnProbability {

  /**
   * @remarks
   * Probabiltity between [0.0, 0.75] of creatures spawning within the
   * biome on chunk generation.
   */
  probability?: number;

}


/**
 * Biome Humidity (minecraft:humidity)
 * Forces a biome to ether always be humid or never humid. Humidity
 * effects the spread chance, and spread rate of fire in the 
 * biome.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftHumidity {

  is_humid: boolean;

}


/**
 * Biome Map Tints (minecraft:map_tints)
 * Sets the color grass and foliage will be tinted by in this biome
 * on the map.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftMapTints {

  /**
   * @remarks
   * Sets the color foliage will be tinted by in this biome on the
   * map.
   */
  foliage?: string;

  /**
   * @remarks
   * Controls whether the grass will use a custom tint color or a
   * noise based tint color.
   */
  grass: object;

}


/**
 * Biome Mountain Parameters (minecraft:mountain_parameters)
 * Noise parameters used to drive mountain terrain generation in
 * Overworld.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParameters {

  /**
   * @remarks
   * Enable for east-facing slopes
   */
  east_slopes?: boolean;

  /**
   * @remarks
   * Block type use as steep material
   */
  material?: BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParametersMaterial;

  /**
   * @remarks
   * Enable for north-facing slopes
   */
  north_slopes?: boolean;

  /**
   * @remarks
   * Enable for south-facing slopes
   */
  south_slopes?: boolean;

  /**
   * @remarks
   * Defines surface material for steep slopes
   */
  steep_material_adjustment?: BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParametersSteepMaterialAdjustment;

  /**
   * @remarks
   * Controls the density tapering that happens at the top of the
   * world to prevent terrain from reaching too high
   */
  top_slide?: BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParametersTopSlide;

  /**
   * @remarks
   * Enable for west-facing slopes
   */
  west_slopes?: boolean;

}


/**
 * Material
 * Specifies a particular block. Can be a string block name or a
 * JSON object.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParametersMaterial {

}


/**
 * Mountain Parameters - Steep Material Adjustment Settings
 * (minecraft:mountain_parameters - steep_material_adjustment 
 * settings)
 * Defines surface material for steep slopes.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParametersSteepMaterialAdjustment {

  /**
   * @remarks
   * Enable for east-facing slopes
   */
  east_slopes?: boolean;

  /**
   * @remarks
   * Block type use as steep material
   */
  material?: string;

  /**
   * @remarks
   * Enable for north-facing slopes
   */
  north_slopes?: boolean;

  /**
   * @remarks
   * Enable for south-facing slopes
   */
  south_slopes?: boolean;

  /**
   * @remarks
   * Enable for west-facing slopes
   */
  west_slopes?: boolean;

}


/**
 * Mountain Parameters - Top Slide Settings
 * (minecraft:mountain_parameters - top_slide settings)
 * Controls the density tapering that happens at the top of the
 * world to prevent terrain from reaching too high.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftMountainParametersTopSlide {

  /**
   * @remarks
   * If false, top slide will be disabled. If true, other parameters will
   * be taken into account.
   */
  enabled: boolean;

}


/**
 * Biome Multinoise Generation Rules
 * (minecraft:multinoise_generation_rules)
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the nether.
 * Note: This is a pre-Caves and Cliffs component and is unused for
 * custom biomes.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftMultinoiseGenerationRules {

  /**
   * @remarks
   * Altitude with which this biome should be generated, relative to
   * other biomes.
   */
  target_altitude?: number;

  /**
   * @remarks
   * Humidity with which this biome should be generated, relative to
   * other biomes.
   */
  target_humidity?: number;

  /**
   * @remarks
   * Temperature with which this biome should be generated, relative to
   * other biomes.
   */
  target_temperature?: number;

  /**
   * @remarks
   * Weirdness with which this biome should be generated, relative to
   * other biomes.
   */
  target_weirdness?: number;

  /**
   * @remarks
   * Weight with which this biome should be generated, relative to
   * other biomes.
   */
  weight?: number;

}


/**
 * Biome Overworld Generation Rules
 * (minecraft:overworld_generation_rules)
 * Controls how this biome is instantiated (and then potentially modified)
 * during world generation of the overworld.
 * Note: This is a pre-Caves and Cliffs component and is unused for
 * custom biomes.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftOverworldGenerationRules {

  /**
   * @remarks
   * Can be just the name of a biome, or an array of any size. If an
   * array, each entry can be a biome name string, or an array of
   * size 2, where the first entry is a biome name and the second entry
   * is a positive integer representing how that biome is weighted against
   * other entries. If no weight is provided, a weight of 1 is 
   * used.
   */
  generate_for_climates?: object[];

  /**
   * @remarks
   * An array of any size containing arrays of exactly two elements. For
   * each contained array, the first element is a climate category string
   * ('medium', 'warm', 'lukewarm', 'cold', or 'frozen'). The second
   * element is a positive integer for how much that entry is
   * weighted relative to other entries.
   */
  hills_transformation?: string[];

  /**
   * @remarks
   * What biome to switch to when converting to a mutated biome
   */
  mutate_transformation?: string[];

  /**
   * @remarks
   * What biome to switch to when converting to a river biome (if not
   * the Vanilla 'river' biome)
   */
  river_transformation?: string[];

  /**
   * @remarks
   * What biome to switch to when adjacent to an ocean biome
   */
  shore_transformation?: string[];

}


/**
 * Biome Overworld Height (minecraft:overworld_height)
 * Noise parameters used to drive terrain height in the 
 * Overworld.
 * Note: This is a pre-Caves and Cliffs component. It does not
 * change overworld height, and currently only affects map item
 * rendering.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftOverworldHeight {

  /**
   * @remarks
   * First value is depth - more negative means deeper underwater, while
   * more positive means higher. Second value is scale, which affects how
   * much noise changes as it moves from the surface.
   */
  noise_params?: number[];

  /**
   * @remarks
   * Specifies a preset based on a built-in setting rather than
   * manually using noise_params
   */
  noise_type?: string;

}


/**
 * Biome Replace Biomes (minecraft:replace_biomes)
 * Replaces a specified portion of one or more Minecraft 
 * biomes.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftReplaceBiomes {

  /**
   * @remarks
   * List of biome replacement configurations. Retroactively adding a
   * new replacement to the front of this list will cause the world
   * generation to change. Please add any new replacements to the end
   * of the list.
   */
  replacements: BiomeJSONFileMinecraftBiomeComponentsMinecraftReplaceBiomesReplacements;

}


/**
 * Biome Replacement (Biome Replacement)
 * Represents the replacement information used to determine the
 * placement of the overriding biome.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftReplaceBiomesReplacements {

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
  targets: object[];

}


/**
 * Biome Surface Builder (minecraft:surface_builder)
 * Controls the materials used for terrain generation.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceBuilder {

  /**
   * @remarks
   * Controls the block types used for terrain generation.
   */
  builder: BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceBuilderBuilder;

}


/**
 * Biome Overworld (minecraft:overworld)
 * Controls the blocks used for the default Minecraft Overworld terrain
 * generation.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceBuilderBuilder {

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

  /**
   * @remarks
   * Controls the type of surface builder to use
   */
  type: string;

}


/**
 * Biome Surface Material Adjustments
 * (minecraft:surface_material_adjustments)
 * Specify fine-detail changes to blocks used in terrain generation (based
 * on a noise function).
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustments {

  /**
   * @remarks
   * All adjustments that match the column's noise values will be
   * applied in the order listed.
   */
  adjustments?: BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustments[];

}


/**
 * Surface Material Adjustments - Surface Adjustment Settings
 * (minecraft:surface_material_adjustments - surface adjustment 
 * settings)
 * An adjustment to generated terrain, replacing blocks based on
 * the specified settings.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustments {

  /**
   * @remarks
   * Defines a range of noise values [min, max] for which this
   * adjustment should be applied.
   */
  height_range?: number;

  /**
   * @remarks
   * The specific blocks used for this surface adjustment
   */
  materials: BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials;

  /**
   * @remarks
   * The scale to multiply by the position when accessing the noise
   * value for the material adjustments.
   */
  noise_frequency_scale?: number;

  /**
   * @remarks
   * Defines a range of noise values [min, max] for which this
   * adjustment should be applied.
   */
  noise_range?: number[];

}


/**
 * Surface Material Adjustments - Surface Adjustment Materials Settings
 * (minecraft:surface_material_adjustments - surface adjustment materials
 * settings)
 * The specific blocks used for this surface adjustment.
 */
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftSurfaceMaterialAdjustmentsAdjustmentsMaterials {

  /**
   * @remarks
   * Controls the block type used deep underground in this biome when
   * this adjustment is active.
   */
  foundation_material?: string;

  /**
   * @remarks
   * Controls the block type used in a layer below the surface of
   * this biome when this adjustment is active.
   */
  mid_material?: string;

  /**
   * @remarks
   * Controls the block type used as a floor for bodies of water in
   * this biome when this adjustment is active.
   */
  sea_floor_material?: string;

  /**
   * @remarks
   * Controls the block type used in the bodies of water in this biome
   * when this adjustment is active.
   */
  sea_material?: string;

  /**
   * @remarks
   * Controls the block type used for the surface of this biome when
   * this adjustment is active.
   */
  top_material?: string;

}


/**
 * Biome Tags (minecraft:tags)
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
export interface BiomeJSONFileMinecraftBiomeComponentsMinecraftTags {

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
export interface BiomeJSONFileMinecraftBiomeDescription {

  /**
   * @remarks
   * The name of the Biome, used by other features like the '/locate
   * biome' command. Identifiers should only be lowercase.
   */
  identifier: object;

}