// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:waterconfig_waterconfigsettingsv1
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Water Settings
 * Struct WaterConfig WaterConfigSettingsV1 Client Deferred 
 * Rendering.
 */
export default interface WaterSettings {

  /**
   * @remarks
   * [editor(readonly:true)]
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:water_settings
   */
  "minecraft:water_settings": WaterSettingsMinecraftWaterSettings;

}


/**
 * WaterConfig WaterConfigSettingsV1 WaterSettings
 * WaterConfig WaterConfigSettingsV1 WaterSettings.
 */
export interface WaterSettingsMinecraftWaterSettings {

  /**
   * @remarks
   * caustics
   */
  caustics: WaterSettingsMinecraftWaterSettingsCaustics;

  /**
   * @remarks
   * description
   */
  description: WaterSettingsMinecraftWaterSettingsDescription;

  /**
   * @remarks
   * particle_concentrations
   */
  particle_concentrations: WaterSettingsMinecraftWaterSettingsParticleConcentrations;

  /**
   * @remarks
   * waves
   */
  waves: WaterSettingsMinecraftWaterSettingsWaves;

}


/**
 * Mce Framebuilder CausticsParameters
 * Mce Framebuilder CausticsParameters.
 */
export interface WaterSettingsMinecraftWaterSettingsCaustics {

  /**
   * @remarks
   * enabled
   */
  enabled: boolean;

  /**
   * @remarks
   * frame_length
   */
  frame_length: number;

  /**
   * @remarks
   * power
   */
  power: number;

  /**
   * @remarks
   * scale
   */
  scale: number;

  /**
   * @remarks
   * texture
   */
  texture: string;

}


/**
 * WaterConfig WaterConfigSettingsV0 WaterSettings 
 * WaterDescription
 * WaterConfig WaterConfigSettingsV0 WaterSettings 
 * WaterDescription.
 */
export interface WaterSettingsMinecraftWaterSettingsDescription {

  /**
   * @remarks
   * identifier
   */
  identifier: string;

}


/**
 * WaterConfig WaterConfigSettingsV0 WaterSettings PSY
 * WaterConfig WaterConfigSettingsV0 WaterSettings PSY.
 */
export interface WaterSettingsMinecraftWaterSettingsParticleConcentrations {

  /**
   * @remarks
   * cdom
   */
  cdom: number;

  /**
   * @remarks
   * chlorophyll
   */
  chlorophyll: number;

  /**
   * @remarks
   * suspended_sediment
   */
  suspended_sediment: number;

}


/**
 * Mce Framebuilder WaterSurfaceParameters
 * Mce Framebuilder WaterSurfaceParameters.
 */
export interface WaterSettingsMinecraftWaterSettingsWaves {

  /**
   * @remarks
   * depth
   */
  depth: number;

  /**
   * @remarks
   * direction_increment
   */
  direction_increment: number;

  /**
   * @remarks
   * enabled
   */
  enabled: boolean;

  /**
   * @remarks
   * frequency
   */
  frequency: number;

  /**
   * @remarks
   * frequency_scaling
   */
  frequency_scaling: number;

  /**
   * @remarks
   * mix
   */
  mix: number;

  /**
   * @remarks
   * octaves
   */
  octaves: number;

  /**
   * @remarks
   * pull
   */
  pull: number;

  /**
   * @remarks
   * sampleWidth
   */
  sampleWidth: number;

  /**
   * @remarks
   * shape
   */
  shape: number;

  /**
   * @remarks
   * speed
   */
  speed: number;

  /**
   * @remarks
   * speed_scaling
   */
  speed_scaling: number;

}