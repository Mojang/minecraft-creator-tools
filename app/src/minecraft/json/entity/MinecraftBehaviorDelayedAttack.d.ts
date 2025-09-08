// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.delayed_attack
 * 
 * minecraft:behavior.delayed_attack Samples

Ravager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ravager.json

"minecraft:behavior.delayed_attack": {
  "priority": 4,
  "attack_once": false,
  "track_target": true,
  "require_complete_path": false,
  "random_stop_interval": 0,
  "reach_multiplier": 1.5,
  "speed_multiplier": 1,
  "attack_duration": 0.75,
  "hit_delay_pct": 0.5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Delayed Attack Behavior (minecraft:behavior.delayed_attack)
 * Allows an entity to attack, while also delaying the damage-dealt until
 * a specific time in the attack animation.
 */
export default interface MinecraftBehaviorDelayedAttack {

  /**
   * @remarks
   * The entity's attack animation will play out over this duration (in
   * seconds). Also controls attack cooldown.
   * 
   * Sample Values:
   * Ravager: 0.75
   *
   */
  attack_duration?: number;

  /**
   * @remarks
   * Allows the entity to use this attack behavior, only once 
   * EVER.
   */
  attack_once?: boolean;

  /**
   * @remarks
   * Defines the entity types this entity will attack.
   */
  attack_types?: string;

  /**
   * @remarks
   * If the entity is on fire, this allows the entity's target to
   * catch on fire after being hit.
   */
  can_spread_on_fire?: boolean;

  /**
   * @remarks
   * The percentage into the attack animation to apply the damage of
   * the attack (1.0 = 100%).
   * 
   * Sample Values:
   * Ravager: 0.5
   *
   */
  hit_delay_pct?: number;

  /**
   * @remarks
   * Time (in seconds) to add to attack path recalculation when the
   * target is beyond the "path_inner_boundary".
   */
  inner_boundary_time_increase?: number;

  /**
   * @remarks
   * Maximum base time (in seconds) to recalculate new attack path to
   * target (before increases applied).
   */
  max_path_time?: number;

  /**
   * @remarks
   * Field of view (in degrees) when using the sensing component to
   * detect an attack target.
   */
  melee_fov?: number;

  /**
   * @remarks
   * Minimum base time (in seconds) to recalculate new attack path to
   * target (before increases applied).
   */
  min_path_time?: number;

  /**
   * @remarks
   * Defines the event to trigger when this entity successfully 
   * attacks.
   */
  on_attack?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Defines the event to trigger when this entity kills the 
   * target.
   */
  on_kill?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Time (in seconds) to add to attack path recalculation when the
   * target is beyond the "path_outer_boundary".
   */
  outer_boundary_time_increase?: number;

  /**
   * @remarks
   * Time (in seconds) to add to attack path recalculation when this
   * entity cannot move along the current path.
   */
  path_fail_time_increase?: number;

  /**
   * @remarks
   * Distance at which to increase attack path recalculation by
   * "inner_boundary_tick_increase".
   */
  path_inner_boundary?: number;

  /**
   * @remarks
   * Distance at which to increase attack path recalculation by
   * "outer_boundary_tick_increase".
   */
  path_outer_boundary?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ravager: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * This entity will have a 1 in N chance to stop it's current attack,
   * where N = "random_stop_interval".
   */
  random_stop_interval?: number;

  /**
   * @remarks
   * Used with the base size of the entity to determine minimum
   * target-distance before trying to deal attack damage.
   * 
   * Sample Values:
   * Ravager: 1.5
   *
   */
  reach_multiplier?: number;

  /**
   * @remarks
   * Toggles (on/off) the need to have a full path from the entity to
   * the target when using this melee attack behavior.
   */
  require_complete_path?: boolean;

  /**
   * @remarks
   * This multiplier modifies the attacking entity's speed when moving
   * toward the target.
   * 
   * Sample Values:
   * Ravager: 1
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Allows the entity to track the attack target, even if the entity
   * has no sensing.
   * 
   * Sample Values:
   * Ravager: true
   *
   */
  track_target?: boolean;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   */
  x_max_rotation?: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   */
  y_max_head_rotation?: number;

}