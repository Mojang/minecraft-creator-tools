// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:atmosphere_identifier
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Atmosphere Identifier 
 * (minecraft:atmosphere_identifier)
 * Set the identifier used for atmospherics in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Atmospheric Scattering
 * JSON schemas under the "atmospherics" directory. Biomes without this
 * component will have default atmosphere settings.
 */
export default interface MinecraftAtmosphereIdentifier {

  /**
   * @remarks
   * Identifier of atmosphere definition to use
   */
  atmosphere_identifier: object;

}