// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:dry_foliage_color
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Client Biome Dry Foliage Color (minecraft:dry_foliage_color)
 * Set the dry foliage color used during rendering. Biomes without this
 * component will have default dry foliage color behavior.
 */
export default interface MinecraftDryFoliageColor {

  /**
   * @remarks
   * RGB color of dry foliage
   */
  color: string;

}