// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Visuals Documentation - minecraft:texture_set.v1.21.30
 */

import * as jsoncommon from './../../jsoncommon';

/**
 */
export default interface TextureSet {

  format_version: string | number[];

  "minecraft:texture_set": TextureSetMinecraftTextureSet;

}


/**
 */
export interface TextureSetMinecraftTextureSet {

  /**
   * @remarks
   * The texture name of a textureset layer
   */
  color: string;

  /**
   * @remarks
   * The texture name of a textureset layer
   */
  heightmap: string;

  /**
   * @remarks
   * The texture name of a textureset layer
   */
  metalness_emissive_roughness: string;

  /**
   * @remarks
   * The texture name of a textureset layer
   */
  metalness_emissive_roughness_subsurface: string;

  /**
   * @remarks
   * The texture name of a textureset layer
   */
  normal: string;

}