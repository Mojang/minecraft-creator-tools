// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:water_identifier
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Water Identifier Client Biome
 * (minecraft:water_identifier)
 * [INTERNAL - WORK IN PROGRESS] Set the water settings used during
 * deferred rendering. Biomes without this component will have
 * default water settings.
 */
export default interface MinecraftWaterIdentifier {

  /**
   * @remarks
   * Identifier of water definition to use
   */
  water_identifier: string;

}