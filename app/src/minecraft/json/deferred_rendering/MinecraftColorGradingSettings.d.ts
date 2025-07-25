// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:colorgraderconfig_colorgradingparameterssrc
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Color Grading Settings (minecraft:color_grading_settings)
 * Minecraft's color grading system allows for many degrees of
 * customization of the final image. You can control the
 * saturation, contrast, gain, and offset of pixels per RGB
 * channel. This can be done on a global scale regardless of pixel
 * luminance, or it can be done on a more fine-grained scale with
 * unique sets of parameters for shadows, midtones and 
 * highlights.
 */
export default interface MinecraftColorGradingSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:color_grading_settings
   */
  "minecraft:color_grading_settings": MinecraftColorGradingSettingsMinecraftColorGradingSettings;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc 
 * ColorGradingSettings
 * ColorGraderConfig ColorGradingParametersSrc 
 * ColorGradingSettings.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettings {

  /**
   * @remarks
   * color_grading
   */
  color_grading: MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGrading;

  /**
   * @remarks
   * description
   */
  description: MinecraftColorGradingSettingsMinecraftColorGradingSettingsDescription;

  /**
   * @remarks
   * tone_mapping
   */
  tone_mapping: MinecraftColorGradingSettingsMinecraftColorGradingSettingsToneMapping;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * ColorGrading
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * ColorGrading.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGrading {

  /**
   * @remarks
   * highlights
   */
  highlights: MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGradingHighlights;

  /**
   * @remarks
   * midtones
   */
  midtones: MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGradingMidtones;

  /**
   * @remarks
   * shadows
   */
  shadows: MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGradingShadows;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Highlights
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Highlights.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGradingHighlights {

  /**
   * @remarks
   * contrast
   */
  contrast: number[];

  /**
   * @remarks
   * enabled
   */
  enabled: boolean;

  /**
   * @remarks
   * gain
   */
  gain: number[];

  /**
   * @remarks
   * gamma
   */
  gamma: number[];

  /**
   * @remarks
   * highlightsMin
   */
  highlightsMin: number;

  /**
   * @remarks
   * offset
   */
  offset: number[];

  /**
   * @remarks
   * saturation
   */
  saturation: number[];

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Midtones
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Midtones.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGradingMidtones {

  /**
   * @remarks
   * contrast
   */
  contrast: number[];

  /**
   * @remarks
   * gain
   */
  gain: number[];

  /**
   * @remarks
   * gamma
   */
  gamma: number[];

  /**
   * @remarks
   * offset
   */
  offset: number[];

  /**
   * @remarks
   * saturation
   */
  saturation: number[];

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Shadows
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Shadows.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettingsColorGradingShadows {

  /**
   * @remarks
   * contrast
   */
  contrast: number[];

  /**
   * @remarks
   * enabled
   */
  enabled: boolean;

  /**
   * @remarks
   * gain
   */
  gain: number[];

  /**
   * @remarks
   * gamma
   */
  gamma: number[];

  /**
   * @remarks
   * offset
   */
  offset: number[];

  /**
   * @remarks
   * saturation
   */
  saturation: number[];

  /**
   * @remarks
   * shadowsMax
   */
  shadowsMax: number;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings
 * ColorGradingDescription
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings
 * ColorGradingDescription.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettingsDescription {

  /**
   * @remarks
   * identifier
   */
  identifier: string;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * ToneMapping
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * ToneMapping.
 */
export interface MinecraftColorGradingSettingsMinecraftColorGradingSettingsToneMapping {

  /**
   * @remarks
   * enum dragon_framerenderer_modules_Tonemapper
   */
  operator: string;

}