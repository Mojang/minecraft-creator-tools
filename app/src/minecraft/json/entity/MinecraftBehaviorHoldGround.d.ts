// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.hold_ground
 * 
 * minecraft:behavior.hold_ground Samples

Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

 * At /minecraft:entity/component_groups/minecraft:patrol_captain/minecraft:behavior.hold_ground/: 
"minecraft:behavior.hold_ground": {
  "priority": 5,
  "min_radius": 10,
  "broadcast": true,
  "broadcast_range": 8,
  "within_radius_event": {
    "event": "minecraft:ranged_mode",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/minecraft:patrol_follower/minecraft:behavior.hold_ground/: 
"minecraft:behavior.hold_ground": {
  "priority": 6,
  "min_radius": 10,
  "broadcast": true,
  "broadcast_range": 8,
  "within_radius_event": {
    "event": "minecraft:ranged_mode",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Hold Ground Behavior (minecraft:behavior.hold_ground)
 * Compels an entity to stop at their current location, turn to
 * face a mob they are targeting, and react with an event.
 */
export default interface MinecraftBehaviorHoldGround {

  /**
   * @remarks
   * Whether to broadcast out the mob's target to other mobs of the
   * same type.
   * 
   * Sample Values:
   * Pillager: true
   *
   */
  broadcast?: boolean;

  /**
   * @remarks
   * Range in blocks for how far to broadcast.
   * 
   * Sample Values:
   * Pillager: 8
   *
   */
  broadcast_range?: number;

  /**
   * @remarks
   * Minimum distance the target must be for the mob to run this 
   * goal.
   * 
   * Sample Values:
   * Pillager: 10
   *
   */
  min_radius?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Pillager: 5, 6
   *
   */
  priority?: number;

  /**
   * @remarks
   * Event to run when target is within the radius. This event is
   * broadcasted if broadcast is true.
   * 
   * Sample Values:
   * Pillager: {"event":"minecraft:ranged_mode","target":"self"}
   *
   */
  within_radius_event?: string;

}