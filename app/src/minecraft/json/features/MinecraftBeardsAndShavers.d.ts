// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:beards_and_shavers
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Beards And Shavers (minecraft:beards_and_shavers)
 * IMPORTANT
 * This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content.
 * 
 */
export default interface MinecraftBeardsAndShavers {

  /**
   * @remarks
   * Dimensions of the Bounding Box
   */
  bounding_box_max: string[];

  /**
   * @remarks
   * Dimensions of the Bounding Box
   */
  bounding_box_min: string[];

  description: MinecraftBeardsAndShaversDescription;

  format_version: string;

}


/**
 */
export interface MinecraftBeardsAndShaversDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}