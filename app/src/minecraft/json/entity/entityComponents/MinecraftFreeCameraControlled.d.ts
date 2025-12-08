// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:free_camera_controlled
 * 
 * minecraft:free_camera_controlled Samples

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:free_camera_controlled": {
  "strafe_speed_modifier": 1,
  "backwards_movement_modifier": 0.5
}


Nautilus - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/nautilus.json

"minecraft:free_camera_controlled": {
  "strafe_speed_modifier": 0.7,
  "backwards_movement_modifier": 0.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Free Camera Controlled (minecraft:free_camera_controlled)
 * When configured as a rideable entity, the entity will be
 * controlled using WASD controls and mouse to move in three
 * dimensions.
 */
export default interface MinecraftFreeCameraControlled {

  /**
   * @remarks
   * Modifies speed going backwards.
   * 
   * Sample Values:
   * Happy Ghast: 0.5
   *
   *
   */
  backwards_movement_modifier?: number;

  /**
   * @remarks
   * Modifies the strafe speed.
   * 
   * Sample Values:
   * Happy Ghast: 1
   *
   * Nautilus: 0.7
   *
   *
   */
  strafe_speed_modifier?: number;

}