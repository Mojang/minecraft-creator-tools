// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:cubemap_identifier
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Cubemap Identifier 
 * (minecraft:cubemap_identifier)
 * Set the identifier used for cubemap in Vibrant Visuals mode.
 * Identifiers must resolve to identifiers in valid Cubemap JSON
 * schemas under the "cubemaps" directory. Biomes without this
 * component will have default cubemap settings.
 */
export default interface MinecraftCubemapIdentifier {

  /**
   * @remarks
   * Identifier of cubemap definition to use
   */
  cubemap_identifier: object;

}