// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:random_offset
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Random Offset (minecraft:random_offset)
 * This component defines a random offset for the block, seeded based
 * on the block's position and the specified range and steps. It
 * affects the block's rendered position, outline, and
 * collision.
If the random offset causes the collision box to
 * extend beyond the bounds of a cube, the offset range will
 * automatically adjust to keep the collision box within the
 * cube.
Culling for this block is performed without considering the
 * random offset.
 */
export default interface MinecraftRandomOffset {

  /**
   * @remarks
   * X coordinate
   */
  x?: MinecraftRandomOffsetx;

  /**
   * @remarks
   * Y coordinate
   */
  y?: MinecraftRandomOffsety;

  /**
   * @remarks
   * Z coordinate
   */
  z?: MinecraftRandomOffsetz;

}


/**
 * Range of values between two numbers
 * Specifies a range of values between two numbers, with a
 * defined number of steps. This is used to control the variation in
 * block properties such as offset, color, or other attributes.
 */
export interface MinecraftRandomOffsetx {

  /**
   * @remarks
   * Range of values
   */
  range?: MinecraftRandomOffsetxRange;

  /**
   * @remarks
   * Number of steps between the range
   */
  steps?: number;

}


/**
 * Range of values (range)
 */
export interface MinecraftRandomOffsetxRange {

  /**
   * @remarks
   * Maximum value of the range
   */
  max?: number;

  /**
   * @remarks
   * Minimum value of the range
   */
  min?: number;

}


/**
 * Range of values between two numbers
 * Specifies a range of values between two numbers, with a
 * defined number of steps. This is used to control the variation in
 * block properties such as offset, color, or other attributes.
 */
export interface MinecraftRandomOffsety {

  /**
   * @remarks
   * Range of values
   */
  range?: MinecraftRandomOffsetyRange;

  /**
   * @remarks
   * Number of steps between the range
   */
  steps?: number;

}


/**
 * Range of values (range)
 */
export interface MinecraftRandomOffsetyRange {

  /**
   * @remarks
   * Maximum value of the range
   */
  max?: number;

  /**
   * @remarks
   * Minimum value of the range
   */
  min?: number;

}


/**
 * Range of values between two numbers
 * Specifies a range of values between two numbers, with a
 * defined number of steps. This is used to control the variation in
 * block properties such as offset, color, or other attributes.
 */
export interface MinecraftRandomOffsetz {

  /**
   * @remarks
   * Range of values
   */
  range?: MinecraftRandomOffsetzRange;

  /**
   * @remarks
   * Number of steps between the range
   */
  steps?: number;

}


/**
 * Range of values (range)
 */
export interface MinecraftRandomOffsetzRange {

  /**
   * @remarks
   * Maximum value of the range
   */
  max?: number;

  /**
   * @remarks
   * Minimum value of the range
   */
  min?: number;

}