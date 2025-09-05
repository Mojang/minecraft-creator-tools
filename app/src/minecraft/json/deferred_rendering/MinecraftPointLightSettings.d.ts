// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:pointlightconfig_pointlightconfigsettings
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Point Light Settings (minecraft:point_light_settings)
 * Struct PointLightConfig PointLightConfigSettings Client Deferred
 * Rendering.
 */
export default interface MinecraftPointLightSettings {

  /**
   * @remarks
   * format_version
   */
  format_version?: string;

  /**
   * @remarks
   * minecraft:point_light_settings
   */
  "minecraft:point_light_settings"?: MinecraftPointLightSettingsMinecraftPointLightSettings;

}


/**
 * PointLightConfig PointLightConfigSettings PointLightSettings
 * PointLightConfig PointLightConfigSettings 
 * PointLightSettings.
 */
export interface MinecraftPointLightSettingsMinecraftPointLightSettings {

  /**
   * @remarks
   * colors
   */
  colors?: string;

}