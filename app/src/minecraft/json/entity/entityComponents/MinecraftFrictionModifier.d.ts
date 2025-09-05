// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:friction_modifier
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Friction Modifier (minecraft:friction_modifier)
 * Defines how much friction affects this entity.
 */
export default interface MinecraftFrictionModifier {

  /**
   * @remarks
   * The higher the number, the more the friction affects this entity. A
   * value of 1.0 means regular friction, while 2.0 means twice as
   * much.
   */
  value?: number;

}