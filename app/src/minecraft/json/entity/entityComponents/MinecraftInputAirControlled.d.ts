// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:input_air_controlled
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Input Air Controlled (minecraft:input_air_controlled)
 * When configured as a rideable entity, the entity will be
 * controlled using WASD controls and mouse to move in three
 * dimensions. Only available with `"use_beta_features": true` and
 * likely to be drastically changed or removed.
 */
export default interface MinecraftInputAirControlled {

  /**
   * @remarks
   * Modifies speed going backwards.
   */
  backwards_movement_modifier: number;

  /**
   * @remarks
   * Modifies the strafe speed.
   */
  strafe_speed_modifier: number;

}