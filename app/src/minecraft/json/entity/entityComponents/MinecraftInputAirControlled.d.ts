// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:input_air_controlled
 * 
 * minecraft:input_air_controlled Samples

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:input_air_controlled": {
  "strafe_speed_modifier": 1,
  "backwards_movement_modifier": 0.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Input Air Controlled (minecraft:input_air_controlled)
 * When configured as a rideable entity, the entity will be
 * controlled using WASD controls and mouse to move in three
 * dimensions.
 */
export default interface MinecraftInputAirControlled {

  /**
   * @remarks
   * Modifies speed going backwards.
   * 
   * Sample Values:
   * Happy Ghast: 0.5
   *
   */
  backwards_movement_modifier: number;

  /**
   * @remarks
   * Modifies the strafe speed.
   * 
   * Sample Values:
   * Happy Ghast: 1
   *
   */
  strafe_speed_modifier: number;

}