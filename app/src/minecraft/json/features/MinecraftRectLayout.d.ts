// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:rect_layout
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Rect Layout (minecraft:rect_layout)
 * IMPORTANT
 * This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content.
 * 
 */
export default interface MinecraftRectLayout {

  description: MinecraftRectLayoutDescription;

  feature_areas: MinecraftRectLayoutFeatureAreas[];

  format_version: string;

}


/**
 */
export interface MinecraftRectLayoutDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}


/**
 */
export interface MinecraftRectLayoutFeatureAreas {

  _00: number;

  _11: number;

  /**
   * @remarks
   * Dimensions (size) of the associated Feature.
   */
  area_dimensions: string[];

}