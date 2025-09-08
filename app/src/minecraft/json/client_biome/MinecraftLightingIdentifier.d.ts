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
 * Client Biome Lighting Identifier 
 * (minecraft:lighting_identifier)
 * Set the identifier used for lighting in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Lighting JSON
 * schemas under the "lighting" directory. Biomes without this
 * component will have default lighting settings.
 */
export default interface MinecraftLightingIdentifier {

  /**
   * @remarks
   * Identifier of lighting definition to use
   */
  lighting_identifier: object;

}