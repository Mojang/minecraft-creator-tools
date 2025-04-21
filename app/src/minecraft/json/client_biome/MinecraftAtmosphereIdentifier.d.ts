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
 * Minecraft Atmosphere Identifier Client Biome
 * (minecraft:atmosphere_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the atmosphere settings used
 * during deferred rendering. Biomes without this component will
 * have default atmosphere settings.
 */
export default interface MinecraftAtmosphereIdentifier {

  /**
   * @remarks
   * Identifier of atmosphere definition to use
   */
  atmosphere_identifier: string;

}