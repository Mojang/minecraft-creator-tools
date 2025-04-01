// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:transformation
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Transformation (minecraft:transformation)
 * The block's translation, rotation and scale with respect to the
 * center of its world position.
 */
export default interface MinecraftTransformation {

  /**
   * @remarks
   * The block's rotation in increments of 90 degrees
   */
  rotation: string[];

  /**
   * @remarks
   * The point to apply rotation around
   */
  rotation_pivot: number[];

  /**
   * @remarks
   * The block's scale
   */
  scale: number[];

  /**
   * @remarks
   * The point to apply scale around
   */
  scale_pivot: number[];

  /**
   * @remarks
   * The block's translation
   */
  translation: number[];

}