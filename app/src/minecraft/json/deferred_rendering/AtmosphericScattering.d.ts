// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:atmosphericscattering_atmosphericscatteringconfigsettings
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Atmospheric Scattering
 * Customize atmospherics effects.
 */
export default interface AtmosphericScattering {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:atmosphere_settings
   */
  "minecraft:atmosphere_settings": AtmosphericScatteringMinecraftAtmosphereSettings;

}


/**
 * AtmosphericScattering AtmosphericScatteringConfigSettings 
 * AtmosphericScatteringSettings
 * AtmosphericScattering AtmosphericScatteringConfigSettings 
 * AtmosphericScatteringSettings.
 */
export interface AtmosphericScatteringMinecraftAtmosphereSettings {

  /**
   * @remarks
   * description
   */
  description: AtmosphericScatteringMinecraftAtmosphereSettingsDescription;

  /**
   * @remarks
   * horizon_blend_stops
   */
  horizon_blend_stops: AtmosphericScatteringMinecraftAtmosphereSettingsHorizonBlendStops;

  /**
   * @remarks
   * moon_mie_strength
   */
  moon_mie_strength: number;

  /**
   * @remarks
   * rayleigh_strength
   */
  rayleigh_strength: number;

  /**
   * @remarks
   * sky_horizon_color
   */
  sky_horizon_color: { [key: string]: string };

  /**
   * @remarks
   * sky_zenith_color
   */
  sky_zenith_color: { [key: string]: string };

  /**
   * @remarks
   * sun_glare_shape
   */
  sun_glare_shape: number;

  /**
   * @remarks
   * sun_mie_strength
   */
  sun_mie_strength: number;

}


/**
 * AtmosphericScattering AtmosphericScatteringConfigSettings AtmosphericScatteringSettings
 * AtmosphericScatteringDescription
 * AtmosphericScattering AtmosphericScatteringConfigSettings AtmosphericScatteringSettings
 * AtmosphericScatteringDescription.
 */
export interface AtmosphericScatteringMinecraftAtmosphereSettingsDescription {

  /**
   * @remarks
   * identifier
   */
  identifier: string;

}


/**
 * AtmosphericScattering AtmosphericScatteringConfigSettings AtmosphericScatteringSettings
 * HorizonBlendKeyFrames
 * AtmosphericScattering AtmosphericScatteringConfigSettings AtmosphericScatteringSettings
 * HorizonBlendKeyFrames.
 */
export interface AtmosphericScatteringMinecraftAtmosphereSettingsHorizonBlendStops {

  /**
   * @remarks
   * max
   */
  max: number;

  /**
   * @remarks
   * mie_start
   */
  mie_start: number;

  /**
   * @remarks
   * min
   */
  min: number;

  /**
   * @remarks
   * start
   */
  start: number;

}