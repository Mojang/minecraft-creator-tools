// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Client Biomes Documentation - minecraft:foliage_appearance
 * 
 * minecraft:foliage_appearance Samples
"minecraft:foliage_appearance": {
	"minecraft:fog_appearance": {
		"fog_identifier": "minecraft:fog_the_end"
	}
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Foliage Appearance (minecraft:foliage_appearance)
 * Sets the foliage color or color map used during rendering. Biomes
 * without this component will have default foliage appearance.
 */
export default interface MinecraftFoliageAppearance {

  /**
   * @remarks
   * RGB color of foliage, or a Foliage Color Map object.
   */
  color: object;

}