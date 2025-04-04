// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Feature Documentation - minecraft:scan_surface
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Scan Surface (minecraft:scan_surface)
 * IMPORTANT
 * This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content.
 * 
 */
export default interface MinecraftScanSurface {

  description: MinecraftScanSurfaceDescription;

  format_version: string;

}


/**
 */
export interface MinecraftScanSurfaceDescription {

  /**
   * @remarks
   * The name of this feature in the form
   * 'namespace_name:feature_name'. 'feature_name' must match the
   * filename.
   */
  identifier: string;

}