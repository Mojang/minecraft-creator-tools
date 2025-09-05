// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.dragonchargeplayer
 * 
 * minecraft:behavior.dragonchargeplayer Samples

Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:behavior.dragonchargeplayer": {
  "priority": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Dragonchargeplayer Behavior 
 * (minecraft:behavior.dragonchargeplayer)
 * Allows this entity to attack a player by charging at them. The
 * player is chosen by the "minecraft:behavior.dragonscanning".
 */
export default interface MinecraftBehaviorDragonchargeplayer {

  /**
   * @remarks
   * The speed this entity moves when this behavior has started or
   * while it's active.
   */
  active_speed?: number;

  /**
   * @remarks
   * If the dragon is outside the "target_zone" for longer than
   * "continue_charge_threshold_time" seconds, the charge is
   * canceled.
   */
  continue_charge_threshold_time?: number;

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
   * Ender Dragon: 1
   *
   */
  priority?: number;

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

}