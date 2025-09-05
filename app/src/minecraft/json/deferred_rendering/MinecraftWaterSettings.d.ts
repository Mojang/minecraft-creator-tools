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
 * Water Settings (minecraft:water_settings)
 * Struct WaterConfig WaterConfigSettingsV1 Client Deferred 
 * Rendering.
 */
export default interface MinecraftWaterSettings {

  /**
   * @remarks
   * [editor(readonly:true)]
   */
  format_version?: string;

  /**
   * @remarks
   * minecraft:water_settings
   */
  "minecraft:water_settings"?: MinecraftWaterSettingsMinecraftWaterSettings;

}


/**
 * WaterConfig WaterConfigSettingsV1 WaterSettings
 * WaterConfig WaterConfigSettingsV1 WaterSettings.
 */
export interface MinecraftWaterSettingsMinecraftWaterSettings {

  /**
   * @remarks
   * caustics
   */
  caustics?: MinecraftWaterSettingsMinecraftWaterSettingsCaustics;

  /**
   * @remarks
   * description
   */
  description?: MinecraftWaterSettingsMinecraftWaterSettingsDescription;

  /**
   * @remarks
   * particle_concentrations
   */
  particle_concentrations?: MinecraftWaterSettingsMinecraftWaterSettingsParticleConcentrations;

  /**
   * @remarks
   * waves
   */
  waves?: MinecraftWaterSettingsMinecraftWaterSettingsWaves;

}


/**
 * Mce Framebuilder CausticsParameters
 * Mce Framebuilder CausticsParameters.
 */
export interface MinecraftWaterSettingsMinecraftWaterSettingsCaustics {

  /**
   * @remarks
   * enabled
   */
  enabled?: boolean;

  /**
   * @remarks
   * frame_length
   */
  frame_length?: number;

  /**
   * @remarks
   * power
   */
  power?: number;

  /**
   * @remarks
   * scale
   */
  scale?: number;

  /**
   * @remarks
   * texture
   */
  texture?: string;

}


/**
 * WaterConfig WaterConfigSettingsV0 WaterSettings 
 * WaterDescription
 * WaterConfig WaterConfigSettingsV0 WaterSettings 
 * WaterDescription.
 */
export interface MinecraftWaterSettingsMinecraftWaterSettingsDescription {

  /**
   * @remarks
   * identifier
   */
  identifier?: string;

}


/**
 * WaterConfig WaterConfigSettingsV0 WaterSettings PSY
 * WaterConfig WaterConfigSettingsV0 WaterSettings PSY.
 */
export interface MinecraftWaterSettingsMinecraftWaterSettingsParticleConcentrations {

  /**
   * @remarks
   * cdom
   */
  cdom?: number;

  /**
   * @remarks
   * chlorophyll
   */
  chlorophyll?: number;

  /**
   * @remarks
   * suspended_sediment
   */
  suspended_sediment?: number;

}


/**
 * Mce Framebuilder WaterSurfaceParameters
 * Mce Framebuilder WaterSurfaceParameters.
 */
export interface MinecraftWaterSettingsMinecraftWaterSettingsWaves {

  /**
   * @remarks
   * depth
   */
  depth?: number;

  /**
   * @remarks
   * direction_increment
   */
  direction_increment?: number;

  /**
   * @remarks
   * enabled
   */
  enabled?: boolean;

  /**
   * @remarks
   * frequency
   */
  frequency?: number;

  /**
   * @remarks
   * frequency_scaling
   */
  frequency_scaling?: number;

  /**
   * @remarks
   * mix
   */
  mix?: number;

  /**
   * @remarks
   * octaves
   */
  octaves?: number;

  /**
   * @remarks
   * pull
   */
  pull?: number;

  /**
   * @remarks
   * sampleWidth
   */
  sampleWidth?: number;

  /**
   * @remarks
   * shape
   */
  shape?: number;

  /**
   * @remarks
   * speed
   */
  speed?: number;

  /**
   * @remarks
   * speed_scaling
   */
  speed_scaling?: number;

}