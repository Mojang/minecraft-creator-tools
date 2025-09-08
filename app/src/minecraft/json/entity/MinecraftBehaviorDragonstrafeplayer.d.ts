// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragonstrafeplayer
 * 
 * minecraft:behavior.dragonstrafeplayer Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragonstrafeplayer": {
  "priority": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragonstrafeplayer Behavior 
 * (minecraft:behavior.dragonstrafeplayer)
 * Allows this entity to fly around looking for a player to shoot
 * fireballs at.
 */
export default interface MinecraftBehaviorDragonstrafeplayer {

  /**
   * @remarks
   * The speed this entity moves when this behavior has started or
   * while it's active.
   */
  active_speed?: number;

  /**
   * @remarks
   * Maximum distance of this entity's fireball attack while 
   * strafing.
   */
  fireball_range?: number;

  /**
   * @remarks
   * The speed this entity moves while this behavior is not 
   * active.
   */
  flight_speed?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ender Dragon: 2
   *
   */
  priority?: number;

  /**
   * @remarks
   * Percent chance to to switch this entity's strafe direction between
   * clockwise and counterclockwise. Switch direction chance occurs each
   * time a new target is chosen (1.0 = 100%).
   */
  switch_direction_probability?: number;

  /**
   * @remarks
   * Time (in seconds) the target must be in fireball range, and in
   * view [ie, no solid terrain in-between the target and this
   * entity], before a fireball can be shot.
   */
  target_in_range_and_in_view_time?: number;

  /**
   * @remarks
   * Minimum and maximum distance, from the target, this entity can
   * use this behavior.
   */
  target_zone?: number[];

  /**
   * @remarks
   * The speed at which this entity turns while using this 
   * behavior.
   */
  turn_speed?: number;

  /**
   * @remarks
   * The target must be within "view_angle" degrees of the dragon's
   * current rotation before a fireball can be shot.
   */
  view_angle?: number;

}