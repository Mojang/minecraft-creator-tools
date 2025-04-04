// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:lightinggroup_lightingimpl_1_21_70
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Lighting Settings
 * Lighting Settings.
 */
export default interface LightingSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:lighting_settings
   */
  "minecraft:lighting_settings": LightingSettingsMinecraftLightingSettings;

}


/**
 * LightingGroup LightingImpl<1,21,70> LightingSettings
 * LightingGroup LightingImpl<1,21,70> LightingSettings.
 */
export interface LightingSettingsMinecraftLightingSettings {

  /**
   * @remarks
   * ambient
   */
  ambient: LightingSettingsMinecraftLightingSettingsAmbient;

  /**
   * @remarks
   * description
   */
  description: LightingSettingsMinecraftLightingSettingsDescription;

  /**
   * @remarks
   * directional_lights
   */
  directional_lights: LightingSettingsMinecraftLightingSettingsDirectionalLights;

  /**
   * @remarks
   * emissive
   */
  emissive: LightingSettingsMinecraftLightingSettingsEmissive;

  /**
   * @remarks
   * sky
   */
  sky: LightingSettingsMinecraftLightingSettingsSky;

}


/**
 * LightingGroup AmbientLight
 * LightingGroup AmbientLight.
 */
export interface LightingSettingsMinecraftLightingSettingsAmbient {

  /**
   * @remarks
   * color
   */
  color: string;

  /**
   * @remarks
   * illuminance
   */
  illuminance: number;

}


/**
 * LightingGroup LightingDescription
 * LightingGroup LightingDescription.
 */
export interface LightingSettingsMinecraftLightingSettingsDescription {

  /**
   * @remarks
   * identifier
   */
  identifier: string;

}


/**
 * LightingGroup LightingImpl<1,21,70> LightingSettings 
 * DirectionalLights
 * LightingGroup LightingImpl<1,21,70> LightingSettings 
 * DirectionalLights.
 */
export interface LightingSettingsMinecraftLightingSettingsDirectionalLights {

  /**
   * @remarks
   * moon
   */
  moon: LightingSettingsMinecraftLightingSettingsDirectionalLightsMoon;

  /**
   * @remarks
   * orbital_offset_degrees
   */
  orbital_offset_degrees: number;

  /**
   * @remarks
   * sun
   */
  sun: LightingSettingsMinecraftLightingSettingsDirectionalLightsSun;

}


/**
 * LightingGroup LightingImpl<1,21,70> LightingSettings DirectionalLights
 * DirectionalLight
 * LightingGroup LightingImpl<1,21,70> LightingSettings DirectionalLights
 * DirectionalLight.
 */
export interface LightingSettingsMinecraftLightingSettingsDirectionalLightsMoon {

  /**
   * @remarks
   * color
   */
  color: { [key: string]: string };

  /**
   * @remarks
   * illuminance
   */
  illuminance: number;

}


/**
 * LightingGroup LightingImpl<1,21,70> LightingSettings DirectionalLights
 * DirectionalLight
 * LightingGroup LightingImpl<1,21,70> LightingSettings DirectionalLights
 * DirectionalLight.
 */
export interface LightingSettingsMinecraftLightingSettingsDirectionalLightsSun {

  /**
   * @remarks
   * color
   */
  color: { [key: string]: string };

  /**
   * @remarks
   * illuminance
   */
  illuminance: number;

}


/**
 * LightingGroup Emissive
 * LightingGroup Emissive.
 */
export interface LightingSettingsMinecraftLightingSettingsEmissive {

  /**
   * @remarks
   * desaturation
   */
  desaturation: number;

}


/**
 * LightingGroup SkyIntensity<1,21,70>
 * LightingGroup SkyIntensity<1,21,70>.
 */
export interface LightingSettingsMinecraftLightingSettingsSky {

  /**
   * @remarks
   * intensity
   */
  intensity: number;

}