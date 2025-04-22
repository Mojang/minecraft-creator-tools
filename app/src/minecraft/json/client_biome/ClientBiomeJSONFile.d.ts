// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:client_biome_json_file
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome JSON File Client Biome (Client Biome JSON File)
 * Contains a format version and a Client Biome definition.
 */
export default interface ClientBiomeJSONFile {

  /**
   * @remarks
   * Version of the JSON schema used by this file
   */
  format_version: string;

  /**
   * @remarks
   * A single Client Biome definition, containing rendering or sound
   * settings related to a Biome defined by the game or a behavior 
   * pack
   */
  "minecraft:client_biome": ClientBiomeJSONFileMinecraftClientBiome;

}


/**
 * Client Biome Definition (Client Biome Definition)
 * Contains a description and components to define a Client 
 * Biome.
 */
export interface ClientBiomeJSONFileMinecraftClientBiome {

  /**
   * @remarks
   * Components for this Client Biome.
   */
  components: ClientBiomeJSONFileMinecraftClientBiomeComponents;

  /**
   * @remarks
   * Non-component settings, including the Client Biome name.
   */
  description: ClientBiomeJSONFileMinecraftClientBiomeDescription;

}


/**
 * Client Biome Components (Client Biome Components)
 * Any components that this Client Biome uses.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponents {

  /**
   * @remarks
   * Set the ambient sounds for the biome. These sounds must be in
   * the 'individual_named_sounds' in a 'sounds.json' file.
   */
  "minecraft:ambient_sounds": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftAmbientSounds;

  /**
   * @remarks
   * [INTERNAL - WORK IN PROGRESS] Set the atmosphere settings used
   * during deferred rendering. Biomes without this component will
   * have default atmosphere settings.
   */
  "minecraft:atmosphere_identifier": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftAtmosphereIdentifier;

  /**
   * @remarks
   * Affect how music plays within the biome
   */
  "minecraft:biome_music": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftBiomeMusic;

  /**
   * @remarks
   * [INTERNAL - WORK IN PROGRESS] Set the color_grading settings used
   * during deferred rendering. Biomes without this component will
   * have default color_grading settings.
   */
  "minecraft:color_grading_identifier": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftColorGradingIdentifier;

  /**
   * @remarks
   * Set the dry foliage color used during rendering. Biomes without this
   * component will have default dry foliage color behavior.
   */
  "minecraft:dry_foliage_color": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftDryFoliageColor;

  /**
   * @remarks
   * Set the fog settings used during rendering. Biomes without this
   * component will have default fog settings.
   */
  "minecraft:fog_appearance": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftFogAppearance;

  /**
   * @remarks
   * Set the foliage color or color map used during rendering. Biomes
   * without this component will have default foliage appearance.
   */
  "minecraft:foliage_appearance": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftFoliageAppearance;

  /**
   * @remarks
   * Set the grass color or color map used during rendering. Biomes
   * without this component will have default grass appearance.
   */
  "minecraft:grass_appearance": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftGrassAppearance;

  /**
   * @remarks
   * [INTERNAL - WORK IN PROGRESS] Set the lighting settings used
   * during deferred rendering. Biomes without this component will
   * have default lighting settings.
   */
  "minecraft:lighting_identifier": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftLightingIdentifier;

  /**
   * @remarks
   * Set the sky color used during rendering. Biomes without this
   * component will have default sky color behavior.
   */
  "minecraft:sky_color": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftSkyColor;

  /**
   * @remarks
   * Set the water surface color used during rendering. Biomes without
   * this component will have default water surface color 
   * behavior.
   */
  "minecraft:water_appearance": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftWaterAppearance;

  /**
   * @remarks
   * [INTERNAL - WORK IN PROGRESS] Set the water settings used during
   * deferred rendering. Biomes without this component will have
   * default water settings.
   */
  "minecraft:water_identifier": ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftWaterIdentifier;

}


/**
 * Ambient Sounds (minecraft:ambient_sounds)
 * Set the ambient sounds for the biome. These sounds must be in
 * the 'individual_named_sounds' in a 'sounds.json' file.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftAmbientSounds {

  /**
   * @remarks
   * Named sound that occasionally plays at the listener position
   */
  addition: string;

  /**
   * @remarks
   * Named sound that loops while the listener position is inside the
   * biome
   */
  loop: string;

  /**
   * @remarks
   * Named sound that rarely plays at a nearby air block position when
   * the light level is low. Biomes without an ambient mood sound will
   * use the 'ambient.cave' sound.
   */
  mood: string;

}


/**
 * Atmosphere Identifier (minecraft:atmosphere_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the atmosphere settings used
 * during deferred rendering. Biomes without this component will
 * have default atmosphere settings.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftAtmosphereIdentifier {

  /**
   * @remarks
   * Identifier of atmosphere definition to use
   */
  atmosphere_identifier: string;

}


/**
 * Biome Music (minecraft:biome_music)
 * Affect how music plays within the biome.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftBiomeMusic {

  /**
   * @remarks
   * Music to be played when inside this biome. If left off or not
   * found the default music will be determined by the dimension. Empty
   * string will result in no music.
   */
  music_definition: string;

  /**
   * @remarks
   * Multiplier temporarily and gradually applied to music volume when
   * within this biome. Must be a value between 0 and 1, 
   * inclusive.
   */
  volume_multiplier: number;

}


/**
 * Color Grading Identifier 
 * (minecraft:color_grading_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the color_grading settings used
 * during deferred rendering. Biomes without this component will
 * have default color_grading settings.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftColorGradingIdentifier {

  /**
   * @remarks
   * Identifier of color_grading definition to use
   */
  color_grading_identifier: string;

}


/**
 * Dry Foliage Color (minecraft:dry_foliage_color)
 * Set the dry foliage color used during rendering. Biomes without this
 * component will have default dry foliage color behavior.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftDryFoliageColor {

  /**
   * @remarks
   * RGB color of dry foliage
   */
  color: string;

}


/**
 * Fog Appearance (minecraft:fog_appearance)
 * Set the fog settings used during rendering. Biomes without this
 * component will have default fog settings.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftFogAppearance {

  /**
   * @remarks
   * Identifier of fog definition to use
   */
  fog_identifier: string;

}


/**
 * Foliage Appearance (minecraft:foliage_appearance)
 * Set the foliage color or color map used during rendering. Biomes
 * without this component will have default foliage appearance.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftFoliageAppearance {

  /**
   * @remarks
   * RGB color of foliage, or a Foliage Color Map object.
   */
  color: object;

}


/**
 * Grass Appearance (minecraft:grass_appearance)
 * Set the grass color or color map used during rendering. Biomes
 * without this component will have default grass appearance.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftGrassAppearance {

  /**
   * @remarks
   * RGB color of grass.
   */
  color: object;

}


/**
 * Lighting Identifier (minecraft:lighting_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the lighting settings used
 * during deferred rendering. Biomes without this component will
 * have default lighting settings.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftLightingIdentifier {

  /**
   * @remarks
   * Identifier of lighting definition to use
   */
  lighting_identifier: string;

}


/**
 * Sky Color (minecraft:sky_color)
 * Set the sky color used during rendering. Biomes without this
 * component will have default sky color behavior.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftSkyColor {

  /**
   * @remarks
   * RGB color of the sky
   */
  sky_color: string;

}


/**
 * Water Appearance (minecraft:water_appearance)
 * Set the water surface color used during rendering. Biomes without
 * this component will have default water surface color 
 * behavior.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftWaterAppearance {

  /**
   * @remarks
   * RGB color of the water surface
   */
  surface_color: string;

  /**
   * @remarks
   * Opacity of the water surface (must be between 0 for invisible and
   * 1 for opaque, inclusive)
   */
  surface_opacity: number;

}


/**
 * Water Identifier (minecraft:water_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the water settings used during
 * deferred rendering. Biomes without this component will have
 * default water settings.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeComponentsMinecraftWaterIdentifier {

  /**
   * @remarks
   * Identifier of water definition to use
   */
  water_identifier: string;

}


/**
 * Client Biome Description (Client Biome Description)
 * Contains non-component settings for a Client Biome.
 */
export interface ClientBiomeJSONFileMinecraftClientBiomeDescription {

  /**
   * @remarks
   * The name of the Client Biome, used by other features like the
   * '/locate biome' command. Must match the name of a Biome defined by
   * the game or a behavior pack.
   */
  identifier: string;

}