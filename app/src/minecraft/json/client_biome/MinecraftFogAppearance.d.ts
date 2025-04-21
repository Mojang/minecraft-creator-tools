// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:fog_appearance
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Fog Appearance Client Biome 
 * (minecraft:fog_appearance)
 * Sets the fog settings used during rendering. Biomes without this
 * component will have default fog settings.
 */
export default interface MinecraftFogAppearance {

  /**
   * @remarks
   * Identifier of fog definition to use
   */
  fog_identifier: string;

}