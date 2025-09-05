// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:vertical_movement_action
 * 
 * minecraft:vertical_movement_action Samples

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:vertical_movement_action": {
  "vertical_velocity": 0.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Vertical Movement Action 
 * (minecraft:vertical_movement_action)
 * When configured as a rideable entity, the entity will move
 * upwards or downwards when the player uses the jump action.
 */
export default interface MinecraftVerticalMovementAction {

  /**
   * @remarks
   * Vertical velocity to apply when jump action is issued.
   * 
   * Sample Values:
   * Happy Ghast: 0.5
   *
   */
  vertical_velocity?: number;

}