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
 * Lighting Settings (minecraft:lighting_settings)
 * Lighting Settings.
 */
export default interface MinecraftLightingSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:lighting_settings
   */
  "minecraft:lighting_settings": MinecraftLightingSettingsMinecraftLightingSettings;

}


/**
 * LightingGroup LightingImpl<1,21,70> LightingSettings
 * LightingGroup LightingImpl<1,21,70> LightingSettings.
 */
export interface MinecraftLightingSettingsMinecraftLightingSettings {

  /**
   * @remarks
   * ambient
   */
  ambient: MinecraftLightingSettingsMinecraftLightingSettingsAmbient;

  /**
   * @remarks
   * description
   */
  description: MinecraftLightingSettingsMinecraftLightingSettingsDescription;

  /**
   * @remarks
   * directional_lights
   */
  directional_lights: MinecraftLightingSettingsMinecraftLightingSettingsDirectionalLights;

  /**
   * @remarks
   * emissive
   */
  emissive: MinecraftLightingSettingsMinecraftLightingSettingsEmissive;

  /**
   * @remarks
   * sky
   */
  sky: MinecraftLightingSettingsMinecraftLightingSettingsSky;

}


/**
 * LightingGroup AmbientLight
 * LightingGroup AmbientLight.
 */
export interface MinecraftLightingSettingsMinecraftLightingSettingsAmbient {

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
export interface MinecraftLightingSettingsMinecraftLightingSettingsDescription {

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
export interface MinecraftLightingSettingsMinecraftLightingSettingsDirectionalLights {

  /**
   * @remarks
   * moon
   */
  moon: MinecraftLightingSettingsMinecraftLightingSettingsDirectionalLightsMoon;

  /**
   * @remarks
   * orbital_offset_degrees
   */
  orbital_offset_degrees: number;

  /**
   * @remarks
   * sun
   */
  sun: MinecraftLightingSettingsMinecraftLightingSettingsDirectionalLightsSun;

}


/**
 * LightingGroup LightingImpl<1,21,70> LightingSettings DirectionalLights
 * DirectionalLight
 * LightingGroup LightingImpl<1,21,70> LightingSettings DirectionalLights
 * DirectionalLight.
 */
export interface MinecraftLightingSettingsMinecraftLightingSettingsDirectionalLightsMoon {

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
export interface MinecraftLightingSettingsMinecraftLightingSettingsDirectionalLightsSun {

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
export interface MinecraftLightingSettingsMinecraftLightingSettingsEmissive {

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
export interface MinecraftLightingSettingsMinecraftLightingSettingsSky {

  /**
   * @remarks
   * intensity
   */
  intensity: number;

}