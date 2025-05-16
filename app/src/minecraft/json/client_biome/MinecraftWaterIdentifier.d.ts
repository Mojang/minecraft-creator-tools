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
 * Set the identifier used for rendering water in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Water JSON
 * schemas under the "water" directory. Biomes without this
 * component will have default water settings.
 */
export default interface MinecraftWaterIdentifier {

  /**
   * @remarks
   * Identifier of water definition to use
   */
  water_identifier: string;

}