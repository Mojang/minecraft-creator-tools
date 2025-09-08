// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.ocelotattack
 * 
 * minecraft:behavior.ocelotattack Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.ocelotattack": {
  "priority": 4,
  "cooldown_time": 1,
  "x_max_rotation": 30,
  "y_max_head_rotation": 30,
  "max_distance": 15,
  "max_sneak_range": 15,
  "max_sprint_range": 4,
  "reach_multiplier": 2,
  "sneak_speed_multiplier": 0.6,
  "sprint_speed_multiplier": 1.33,
  "walk_speed_multiplier": 0.8
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Ocelotattack Behavior (minecraft:behavior.ocelotattack)
 * Allows an entity to attack by sneaking and pouncing.
 */
export default interface MinecraftBehaviorOcelotattack {

  /**
   * @remarks
   * Time (in seconds) between attacks.
   * 
   * Sample Values:
   * Cat: 1
   *
   *
   */
  cooldown_time?: number;

  /**
   * @remarks
   * Max distance from the target, this entity will use this attack
   * behavior.
   * 
   * Sample Values:
   * Cat: 15
   *
   *
   */
  max_distance?: number;

  /**
   * @remarks
   * Max distance from the target, this entity starts sneaking.
   * 
   * Sample Values:
   * Cat: 15
   *
   *
   */
  max_sneak_range?: number;

  /**
   * @remarks
   * Max distance from the target, this entity starts sprinting (sprinting
   * takes priority over sneaking).
   * 
   * Sample Values:
   * Cat: 4
   *
   *
   */
  max_sprint_range?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Cat: 4
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * Used with the base size of the entity to determine minimum
   * target-distance before trying to deal attack damage.
   * 
   * Sample Values:
   * Cat: 2
   *
   *
   */
  reach_multiplier?: number;

  /**
   * @remarks
   * Modifies the attacking entity's movement speed while 
   * sneaking.
   * 
   * Sample Values:
   * Cat: 0.6
   *
   *
   */
  sneak_speed_multiplier?: number;

  /**
   * @remarks
   * Modifies the attacking entity's movement speed while 
   * sprinting.
   * 
   * Sample Values:
   * Cat: 1.33
   *
   *
   */
  sprint_speed_multiplier?: number;

  /**
   * @remarks
   * Modifies the attacking entity's movement speed when not sneaking or
   * sprinting, but still within attack range.
   * 
   * Sample Values:
   * Cat: 0.8
   *
   *
   */
  walk_speed_multiplier?: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   * 
   * Sample Values:
   * Cat: 30
   *
   *
   */
  x_max_rotation?: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   * 
   * Sample Values:
   * Cat: 30
   *
   *
   */
  y_max_head_rotation?: number;

}