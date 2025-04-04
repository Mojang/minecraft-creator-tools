// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:water_appearance
 * 
 * minecraft:water_appearance Samples
"minecraft:water_appearance": {
	"surface_color": "#62529e"}
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Water Appearance (minecraft:water_appearance)
 * Set the water surface color used during rendering. Biomes without
 * this component will have default water surface color 
 * behavior.
 */
export default interface MinecraftWaterAppearance {

  /**
   * @remarks
   * RGB color of the water surface
   */
  surface_color: string;

  /**
   * @remarks
   * Opacity of the water surface (must be between 0 for invisible and
   * 1 for opaque, inclusive)
   */
  surface_opacity: number;

}