// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:shadowstylizationconfig_shadowstylizationconfigsettings
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Shadow settings
 * Struct ShadowStylizationConfig ShadowStylizationConfigSettings Client
 * Deferred Rendering.
 */
export default interface ShadowSettings {

  /**
   * @remarks
   * format_version
   */
  format_version: string;

  /**
   * @remarks
   * minecraft:shadow_settings
   */
  "minecraft:shadow_settings": ShadowSettingsMinecraftShadowSettings;

}


/**
 * ShadowStylizationConfig ShadowStylizationConfigSettings 
 * ShadowStylizationSettings
 * ShadowStylizationConfig ShadowStylizationConfigSettings 
 * ShadowStylizationSettings.
 */
export interface ShadowSettingsMinecraftShadowSettings {

  /**
   * @remarks
   * enum
   * 
   * ShadowStylizationConfig_ShadowStylizationConfigSettings_ShadowStylizationSettings_ShadowStyle
   */
  shadow_style: string;

  /**
   * @remarks
   * texel_size
   */
  texel_size: number;

}