// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:client_biome_components
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Components (Client Biome Components)
 * Any components that this Client Biome uses.
 */
export default interface ClientBiomeComponents {

  /**
   * @remarks
   * Set the ambient sounds for the biome. These sounds must be in
   * the 'individual_named_sounds' in a 'sounds.json' file.
   */
  "minecraft:ambient_sounds"?: ClientBiomeComponentsMinecraftAmbientSounds;

  /**
   * @remarks
   * Set the identifier used for atmospherics in Vibrant Visuals mode.
   * Identifiers must resolve to identifiers in valid Atmospheric Scattering
   * JSON schemas under the "atmospherics" directory. Biomes without this
   * component will have default atmosphere settings.
   */
  "minecraft:atmosphere_identifier"?: ClientBiomeComponentsMinecraftAtmosphereIdentifier;

  /**
   * @remarks
   * Affect how music plays within the biome
   */
  "minecraft:biome_music"?: ClientBiomeComponentsMinecraftBiomeMusic;

  /**
   * @remarks
   * Set the identifier used for color grading in Vibrant Visuals mode.
   * Identifiers must resolve to identifiers in valid Color Grading JSON
   * schemas under the "color_grading" directory. Biomes without this
   * component will have default color_grading settings.
   */
  "minecraft:color_grading_identifier"?: ClientBiomeComponentsMinecraftColorGradingIdentifier;

  /**
   * @remarks
   * Set the dry foliage color used during rendering. Biomes without this
   * component will have default dry foliage color behavior.
   */
  "minecraft:dry_foliage_color"?: ClientBiomeComponentsMinecraftDryFoliageColor;

  /**
   * @remarks
   * Set the fog settings used during rendering. Biomes without this
   * component will have default fog settings.
   */
  "minecraft:fog_appearance"?: ClientBiomeComponentsMinecraftFogAppearance;

  /**
   * @remarks
   * Set the foliage color or color map used during rendering. Biomes
   * without this component will have default foliage appearance.
   */
  "minecraft:foliage_appearance"?: ClientBiomeComponentsMinecraftFoliageAppearance;

  /**
   * @remarks
   * Set the grass color or color map used during rendering. Biomes
   * without this component will have default grass appearance.
   */
  "minecraft:grass_appearance"?: ClientBiomeComponentsMinecraftGrassAppearance;

  /**
   * @remarks
   * Set the identifier used for lighting in Vibrant Visuals mode.
   * Identifiers must resolve to identifiers in valid Lighting JSON
   * schemas under the "lighting" directory. Biomes without this
   * component will have default lighting settings.
   */
  "minecraft:lighting_identifier"?: ClientBiomeComponentsMinecraftLightingIdentifier;

  /**
   * @remarks
   * Set the sky color used during rendering. Biomes without this
   * component will have default sky color behavior.
   */
  "minecraft:sky_color"?: ClientBiomeComponentsMinecraftSkyColor;

  /**
   * @remarks
   * Set the water surface color used during rendering. Biomes without
   * this component will have default water surface color 
   * behavior.
   */
  "minecraft:water_appearance"?: ClientBiomeComponentsMinecraftWaterAppearance;

  /**
   * @remarks
   * Set the identifier used for rendering water in Vibrant Visuals mode.
   * Identifiers must resolve to identifiers in valid Water JSON
   * schemas under the "water" directory. Biomes without this
   * component will have default water settings.
   */
  "minecraft:water_identifier"?: ClientBiomeComponentsMinecraftWaterIdentifier;

}


/**
 * Minecraft Ambient Sounds (minecraft:ambient_sounds)
 * Sets the ambient sounds for the biome. These sounds must be in
 * the 'individual_named_sounds' in a 'sounds.json' file.
 */
export interface ClientBiomeComponentsMinecraftAmbientSounds {

  /**
   * @remarks
   * Named sound that occasionally plays at the listener position
   */
  addition?: object;

  /**
   * @remarks
   * Named sound that loops while the listener position is inside the
   * biome
   */
  loop?: object;

  /**
   * @remarks
   * Named sound that rarely plays at a nearby air block position when
   * the light level is low. Biomes without an ambient mood sound will
   * use the 'ambient.cave' sound.
   */
  mood?: object;

}


/**
 * Client Biome Atmosphere Identifier 
 * (minecraft:atmosphere_identifier)
 * Set the identifier used for atmospherics in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Atmospheric Scattering
 * JSON schemas under the "atmospherics" directory. Biomes without this
 * component will have default atmosphere settings.
 */
export interface ClientBiomeComponentsMinecraftAtmosphereIdentifier {

  /**
   * @remarks
   * Identifier of atmosphere definition to use
   */
  atmosphere_identifier: object;

}


/**
 * Minecraft Biome Music (minecraft:biome_music)
 * Affects how music plays within the biome.
 */
export interface ClientBiomeComponentsMinecraftBiomeMusic {

  /**
   * @remarks
   * Music to be played when inside this biome. If left off or not
   * found the default music will be determined by the dimension. Empty
   * string will result in no music.
   */
  music_definition?: object;

  /**
   * @remarks
   * Multiplier temporarily and gradually applied to music volume when
   * within this biome. Must be a value between 0 and 1, 
   * inclusive.
   */
  volume_multiplier?: number;

}


/**
 * Client Biome Color Grading Identifier
 * (minecraft:color_grading_identifier)
 * Set the identifier used for color grading in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Color Grading JSON
 * schemas under the "color_grading" directory. Biomes without this
 * component will have default color_grading settings.
 */
export interface ClientBiomeComponentsMinecraftColorGradingIdentifier {

  /**
   * @remarks
   * Identifier of color_grading definition to use
   */
  color_grading_identifier: object;

}


/**
 * Client Biome Dry Foliage Color (minecraft:dry_foliage_color)
 * Set the dry foliage color used during rendering. Biomes without this
 * component will have default dry foliage color behavior.
 */
export interface ClientBiomeComponentsMinecraftDryFoliageColor {

  /**
   * @remarks
   * RGB color of dry foliage
   */
  color: string;

}


/**
 * Minecraft Fog Appearance (minecraft:fog_appearance)
 * Sets the fog settings used during rendering. Biomes without this
 * component will have default fog settings.
 */
export interface ClientBiomeComponentsMinecraftFogAppearance {

  /**
   * @remarks
   * Identifier of fog definition to use
   */
  fog_identifier: object;

}


/**
 * Minecraft Foliage Appearance (minecraft:foliage_appearance)
 * Sets the foliage color or color map used during rendering. Biomes
 * without this component will have default foliage appearance.
 */
export interface ClientBiomeComponentsMinecraftFoliageAppearance {

  /**
   * @remarks
   * RGB color of foliage, or a Foliage Color Map object.
   */
  color?: object;

}


/**
 * Client Biome Grass Appearance (minecraft:grass_appearance)
 * Set the grass color or color map used during rendering. Biomes
 * without this component will have default grass appearance.
 */
export interface ClientBiomeComponentsMinecraftGrassAppearance {

  /**
   * @remarks
   * RGB color of grass.
   */
  color?: object;

}


/**
 * Client Biome Lighting Identifier 
 * (minecraft:lighting_identifier)
 * Set the identifier used for lighting in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Lighting JSON
 * schemas under the "lighting" directory. Biomes without this
 * component will have default lighting settings.
 */
export interface ClientBiomeComponentsMinecraftLightingIdentifier {

  /**
   * @remarks
   * Identifier of lighting definition to use
   */
  lighting_identifier: object;

}


/**
 * Minecraft Sky Color (minecraft:sky_color)
 * Sets the sky color used during rendering. Biomes without this
 * component will have default sky color behavior.
 */
export interface ClientBiomeComponentsMinecraftSkyColor {

  /**
   * @remarks
   * RGB color of the sky
   */
  sky_color: string;

}


/**
 * Client Biome Water Appearance (minecraft:water_appearance)
 * Set the water surface color used during rendering. Biomes without
 * this component will have default water surface color 
 * behavior.
 */
export interface ClientBiomeComponentsMinecraftWaterAppearance {

  /**
   * @remarks
   * RGB color of the water surface
   */
  surface_color?: string;

  /**
   * @remarks
   * Opacity of the water surface (must be between 0 for invisible and
   * 1 for opaque, inclusive)
   */
  surface_opacity?: number;

}


/**
 * Client Biome Water Identifier (minecraft:water_identifier)
 * Set the identifier used for rendering water in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Water JSON
 * schemas under the "water" directory. Biomes without this
 * component will have default water settings.
 */
export interface ClientBiomeComponentsMinecraftWaterIdentifier {

  /**
   * @remarks
   * Identifier of water definition to use
   */
  water_identifier: object;

}