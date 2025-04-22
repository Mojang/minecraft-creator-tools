// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:sky_color
 * 
 * minecraft:sky_color Samples
"minecraft:sky_color": {
	"sky_color": "#000000"}
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Minecraft Sky Color Client Biome (minecraft:sky_color)
 * Sets the sky color used during rendering. Biomes without this
 * component will have default sky color behavior.
 */
export default interface MinecraftSkyColor {

  /**
   * @remarks
   * RGB color of the sky
   */
  sky_color: string;

}