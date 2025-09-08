// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.controlled_by_player
 * 
 * minecraft:behavior.controlled_by_player Samples

Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

"minecraft:behavior.controlled_by_player": {
  "priority": 0
}


Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

"minecraft:behavior.controlled_by_player": {
  "priority": 0,
  "mount_speed_multiplier": 1.45
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Controlled By Player Behavior
 * (minecraft:behavior.controlled_by_player)
 * Allows the entity to be controlled by the player using an item in
 * the item_controllable property (required). On every tick, the
 * entity will attempt to rotate towards where the player is
 * facing with the control item whilst simultaneously moving 
 * forward.
 */
export default interface MinecraftBehaviorControlledByPlayer {

  /**
   * @remarks
   * The entity will attempt to rotate to face where the player is
   * facing each tick. The entity will target this percentage of
   * their difference in their current facing angles each tick (from
   * 0.0 to 1.0 where 1.0 = 100%). This is limited by
   * FractionalRotationLimit. A value of 0.0 will result in the
   * entity no longer turning to where the player is facing.
   */
  fractional_rotation?: number;

  /**
   * @remarks
   * Limits the total degrees the entity can rotate to face where the
   * player is facing on each tick.
   */
  fractional_rotation_limit?: number;

  /**
   * @remarks
   * Speed multiplier of mount when controlled by player.
   * 
   * Sample Values:
   * Strider: 1.45
   *
   */
  mount_speed_multiplier?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

}