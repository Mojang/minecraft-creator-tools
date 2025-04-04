// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Fogs Documentation - minecraft:fogs
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface Fogs {

  format_version: string | number[];

  "minecraft:fog_settings": FogsMinecraftFogSettings;

}


/**
 */
export interface FogsMinecraftFogSettings {

  description: FogsMinecraftFogSettingsDescription;

  /**
   * @remarks
   * The distance fog settings for different camera locations.
   */
  distance: FogsMinecraftFogSettingsDistance;

  /**
   * @remarks
   * The volumetric fog settings.
   */
  volumetric: FogsMinecraftFogSettingsVolumetric;

}


/**
 */
export interface FogsMinecraftFogSettingsDescription {

  /**
   * @remarks
   * The identifier for these fog settings. The identifier must
   * include a namespace.
   */
  identifier: string;

}


/**
 */
export interface FogsMinecraftFogSettingsDistance {

  /**
   * @remarks
   * The fog settings when the camera is in the air.
   */
  air: FogsMinecraftFogSettingsDistanceAir;

  /**
   * @remarks
   * The fog settings when the camera is in lava.
   */
  lava: FogsMinecraftFogSettingsDistanceLava;

  /**
   * @remarks
   * The fog settings when the camera is in lava and the player has
   * the lava resistance effect active.
   */
  lava_resistance: FogsMinecraftFogSettingsDistanceLavaResistance;

  /**
   * @remarks
   * The fog settings when the camera is inside a Powder Snow 
   * block.
   */
  powder_snow: FogsMinecraftFogSettingsDistancePowderSnow;

  /**
   * @remarks
   * The fog settings when the camera is in water.
   */
  water: FogsMinecraftFogSettingsDistanceWater;

  /**
   * @remarks
   * The fog settings for when the camera is in the air with active
   * weather (rain, snow, etc..).
   */
  weather: FogsMinecraftFogSettingsDistanceWeather;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceAir {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

  /**
   * @remarks
   * Additional fog data which will slowly transition to the distance fog
   * of current biome.
   */
  transition_fog: FogsMinecraftFogSettingsDistanceAirTransitionFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceAirTransitionFog {

  /**
   * @remarks
   * Initial fog that will slowly transition into water distance fog
   * of the biome when player goes into water.
   */
  init_fog: FogsMinecraftFogSettingsDistanceAirTransitionFogInitFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceAirTransitionFogInitFog {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceLava {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

  /**
   * @remarks
   * Additional fog data which will slowly transition to the distance fog
   * of current biome.
   */
  transition_fog: FogsMinecraftFogSettingsDistanceLavaTransitionFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceLavaTransitionFog {

  /**
   * @remarks
   * Initial fog that will slowly transition into water distance fog
   * of the biome when player goes into water.
   */
  init_fog: FogsMinecraftFogSettingsDistanceLavaTransitionFogInitFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceLavaTransitionFogInitFog {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceLavaResistance {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

  /**
   * @remarks
   * Additional fog data which will slowly transition to the distance fog
   * of current biome.
   */
  transition_fog: FogsMinecraftFogSettingsDistanceLavaResistanceTransitionFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceLavaResistanceTransitionFog {

  /**
   * @remarks
   * Initial fog that will slowly transition into water distance fog
   * of the biome when player goes into water.
   */
  init_fog: FogsMinecraftFogSettingsDistanceLavaResistanceTransitionFogInitFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceLavaResistanceTransitionFogInitFog {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

}


/**
 */
export interface FogsMinecraftFogSettingsDistancePowderSnow {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

  /**
   * @remarks
   * Additional fog data which will slowly transition to the distance fog
   * of current biome.
   */
  transition_fog: FogsMinecraftFogSettingsDistancePowderSnowTransitionFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistancePowderSnowTransitionFog {

  /**
   * @remarks
   * Initial fog that will slowly transition into water distance fog
   * of the biome when player goes into water.
   */
  init_fog: FogsMinecraftFogSettingsDistancePowderSnowTransitionFogInitFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistancePowderSnowTransitionFogInitFog {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceWater {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

  /**
   * @remarks
   * Additional fog data which will slowly transition to the distance fog
   * of current biome.
   */
  transition_fog: FogsMinecraftFogSettingsDistanceWaterTransitionFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceWaterTransitionFog {

  /**
   * @remarks
   * Initial fog that will slowly transition into water distance fog
   * of the biome when player goes into water.
   */
  init_fog: FogsMinecraftFogSettingsDistanceWaterTransitionFogInitFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceWaterTransitionFogInitFog {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceWeather {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

  /**
   * @remarks
   * Additional fog data which will slowly transition to the distance fog
   * of current biome.
   */
  transition_fog: FogsMinecraftFogSettingsDistanceWeatherTransitionFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceWeatherTransitionFog {

  /**
   * @remarks
   * Initial fog that will slowly transition into water distance fog
   * of the biome when player goes into water.
   */
  init_fog: FogsMinecraftFogSettingsDistanceWeatherTransitionFogInitFog;

}


/**
 */
export interface FogsMinecraftFogSettingsDistanceWeatherTransitionFogInitFog {

  /**
   * @remarks
   * Determines how distance value is used. Fixed distance is
   * measured in blocks. Dynamic distance is multiplied by the
   * current render distance.
   */
  render_distance_typeLessThanfixedrender: string;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetric {

  /**
   * @remarks
   * The density settings for different camera locations.
   */
  density: FogsMinecraftFogSettingsVolumetricDensity;

  /**
   * @remarks
   * The coefficient settings for the volumetric fog in different 
   * blocks.
   */
  media_coefficients: FogsMinecraftFogSettingsVolumetricMediaCoefficients;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricDensity {

  /**
   * @remarks
   * Fog density values as light passes through air blocks.
   */
  air: FogsMinecraftFogSettingsVolumetricDensityAir;

  /**
   * @remarks
   * Fog density values as light passes through lava blocks.
   */
  lava: FogsMinecraftFogSettingsVolumetricDensityLava;

  /**
   * @remarks
   * Fog density values as light passes through lava blocks while the
   * player has lava resistance.
   */
  lava_resistance: FogsMinecraftFogSettingsVolumetricDensityLavaResistance;

  /**
   * @remarks
   * Fog density values as light passes through water blocks.
   */
  water: FogsMinecraftFogSettingsVolumetricDensityWater;

  /**
   * @remarks
   * Fog density values as light passes through air blocks with active
   * weather (rain, snow, etc..).
   */
  weather: FogsMinecraftFogSettingsVolumetricDensityWeather;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricDensityAir {

  /**
   * @remarks
   * When set to true, the density will be uniform across all
   * heights.
   */
  uniform: boolean;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricDensityLava {

  /**
   * @remarks
   * When set to true, the density will be uniform across all
   * heights.
   */
  uniform: boolean;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricDensityLavaResistance {

  /**
   * @remarks
   * When set to true, the density will be uniform across all
   * heights.
   */
  uniform: boolean;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricDensityWater {

  /**
   * @remarks
   * When set to true, the density will be uniform across all
   * heights.
   */
  uniform: boolean;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricDensityWeather {

  /**
   * @remarks
   * When set to true, the density will be uniform across all
   * heights.
   */
  uniform: boolean;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricMediaCoefficients {

  /**
   * @remarks
   * Fog coefficient values while light passes through air.
   */
  air: FogsMinecraftFogSettingsVolumetricMediaCoefficientsAir;

  /**
   * @remarks
   * Fog coefficient values while light passes through clouds.
   */
  cloud: FogsMinecraftFogSettingsVolumetricMediaCoefficientsCloud;

  /**
   * @remarks
   * Fog coefficient values while light passes through water.
   */
  water: FogsMinecraftFogSettingsVolumetricMediaCoefficientsWater;

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricMediaCoefficientsAir {

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricMediaCoefficientsCloud {

}


/**
 */
export interface FogsMinecraftFogSettingsVolumetricMediaCoefficientsWater {

}