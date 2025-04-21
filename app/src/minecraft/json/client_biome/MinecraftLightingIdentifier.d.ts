// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:lighting_identifier
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Lighting Identifier Client Biome
 * (minecraft:lighting_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the lighting settings used
 * during deferred rendering. Biomes without this component will
 * have default lighting settings.
 */
export default interface MinecraftLightingIdentifier {

  /**
   * @remarks
   * Identifier of lighting definition to use
   */
  lighting_identifier: string;

}