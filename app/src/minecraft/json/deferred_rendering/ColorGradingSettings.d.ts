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
 * Color Grading Settings
 * Minecraft's color grading system allows for many degrees of
 * customization of the final image. You can control the
 * saturation, contrast, gain, and offset of pixels per RGB
 * channel. This can be done on a global scale regardless of pixel
 * luminance, or it can be done on a more fine-grained scale with
 * unique sets of parameters for shadows, midtones and 
 * highlights.
 */
export default interface ColorGradingSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:color_grading_settings
   */
  "minecraft:color_grading_settings": ColorGradingSettingsMinecraftColorGradingSettings;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc 
 * ColorGradingSettings
 * ColorGraderConfig ColorGradingParametersSrc 
 * ColorGradingSettings.
 */
export interface ColorGradingSettingsMinecraftColorGradingSettings {

  /**
   * @remarks
   * color_grading
   */
  color_grading: ColorGradingSettingsMinecraftColorGradingSettingsColorGrading;

  /**
   * @remarks
   * description
   */
  description: ColorGradingSettingsMinecraftColorGradingSettingsDescription;

  /**
   * @remarks
   * tone_mapping
   */
  tone_mapping: ColorGradingSettingsMinecraftColorGradingSettingsToneMapping;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * ColorGrading
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * ColorGrading.
 */
export interface ColorGradingSettingsMinecraftColorGradingSettingsColorGrading {

  /**
   * @remarks
   * highlights
   */
  highlights: ColorGradingSettingsMinecraftColorGradingSettingsColorGradingHighlights;

  /**
   * @remarks
   * midtones
   */
  midtones: ColorGradingSettingsMinecraftColorGradingSettingsColorGradingMidtones;

  /**
   * @remarks
   * shadows
   */
  shadows: ColorGradingSettingsMinecraftColorGradingSettingsColorGradingShadows;

}


/**
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Highlights
 * ColorGraderConfig ColorGradingParametersSrc ColorGradingSettings 
 * Highlights.
 */
export interface ColorGradingSettingsMinecraftColorGradingSettingsColorGradingHighlights {

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
export interface ColorGradingSettingsMinecraftColorGradingSettingsColorGradingMidtones {

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
export interface ColorGradingSettingsMinecraftColorGradingSettingsColorGradingShadows {

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
export interface ColorGradingSettingsMinecraftColorGradingSettingsDescription {

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
export interface ColorGradingSettingsMinecraftColorGradingSettingsToneMapping {

  /**
   * @remarks
   * enum dragon_framerenderer_modules_Tonemapper
   */
  operator: string;

}