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
 * Shadow settings (minecraft:shadow_settings)
 * Struct ShadowStylizationConfig ShadowStylizationConfigSettings Client
 * Deferred Rendering.
 */
export default interface MinecraftShadowSettings {

  /**
   * @remarks
   * format_version
   */
  format_version?: string;

  /**
   * @remarks
   * minecraft:shadow_settings
   */
  "minecraft:shadow_settings"?: MinecraftShadowSettingsMinecraftShadowSettings;

}


/**
 * ShadowStylizationConfig ShadowStylizationConfigSettings 
 * ShadowStylizationSettings
 * ShadowStylizationConfig ShadowStylizationConfigSettings 
 * ShadowStylizationSettings.
 */
export interface MinecraftShadowSettingsMinecraftShadowSettings {

  /**
   * @remarks
   * enum
   * 
   * ShadowStylizationConfig_ShadowStylizationConfigSettings_ShadowStylizationSettings_ShadowStyle
   */
  shadow_style?: string;

  /**
   * @remarks
   * texel_size
   */
  texel_size?: number;

}