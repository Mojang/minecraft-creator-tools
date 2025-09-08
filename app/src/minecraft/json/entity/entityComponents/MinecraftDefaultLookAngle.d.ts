// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:default_look_angle
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Default Look Angle (minecraft:default_look_angle)
 * Sets this entity's default head rotation angle.
 */
export default interface MinecraftDefaultLookAngle {

  /**
   * @remarks
   * Angle in degrees.
   */
  value?: number;

}