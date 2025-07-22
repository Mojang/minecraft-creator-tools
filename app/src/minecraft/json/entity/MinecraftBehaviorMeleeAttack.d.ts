// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.melee_attack
 * 
 * minecraft:behavior.melee_attack Samples

Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:behavior.melee_attack": {
  "priority": 4,
  "speed_multiplier": 1.25,
  "track_target": false,
  "reach_multiplier": 0
}


Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:behavior.melee_attack": {
  "priority": 2
}


Cow - https://github.com/microsoft/minecraft-samples/tree/main/behavior_pack_sample/entities/cow.json

"minecraft:behavior.melee_attack": {
  "priority": 3
}


Axe Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/axe_turret.behavior.json

"minecraft:behavior.melee_attack": {
  "priority": 1,
  "melee_fov": 360,
  "speed_multiplier": 5,
  "cooldown_time": 0.1,
  "track_target": true,
  "y_max_head_rotation": 360,
  "x_max_rotation": 360,
  "attack_once": false
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Melee Attack Behavior (minecraft:behavior.melee_attack)
 * Allows an entity to deal damage through a melee attack.
 */
export default interface MinecraftBehaviorMeleeAttack {

  /**
   * @remarks
   * Allows the entity to use this attack behavior, only once 
   * EVER.
   */
  attack_once: boolean;

  /**
   * @remarks
   * Defines the entity types this entity will attack.
   */
  attack_types: string;

  /**
   * @remarks
   * If the entity is on fire, this allows the entity's target to
   * catch on fire after being hit.
   */
  can_spread_on_fire: boolean;

  /**
   * @remarks
   * Cooldown time (in seconds) between attacks.
   * 
   * Sample Values:
   * Axe Turret: 0.1
   *
   */
  cooldown_time: number;

  /**
   * @remarks
   * Time (in seconds) to add to attack path recalculation when the
   * target is beyond the "path_inner_boundary".
   */
  inner_boundary_time_increase: number;

  /**
   * @remarks
   * Maximum base time (in seconds) to recalculate new attack path to
   * target (before increases applied).
   */
  max_path_time: number;

  /**
   * @remarks
   * Field of view (in degrees) when using the sensing component to
   * detect an attack target.
   * 
   * Sample Values:
   * Axe Turret: 360
   *
   */
  melee_fov: number;

  /**
   * @remarks
   * Minimum base time (in seconds) to recalculate new attack path to
   * target (before increases applied).
   */
  min_path_time: number;

  /**
   * @remarks
   * Defines the event to trigger when this entity successfully 
   * attacks.
   */
  on_attack: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Defines the event to trigger when this entity kills the 
   * target.
   */
  on_kill: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Time (in seconds) to add to attack path recalculation when the
   * target is beyond the "path_outer_boundary".
   */
  outer_boundary_time_increase: number;

  /**
   * @remarks
   * Time (in seconds) to add to attack path recalculation when this
   * entity cannot move along the current path.
   */
  path_fail_time_increase: number;

  /**
   * @remarks
   * Distance at which to increase attack path recalculation by
   * "inner_boundary_tick_increase".
   */
  path_inner_boundary: number;

  /**
   * @remarks
   * Distance at which to increase attack path recalculation by
   * "outer_boundary_tick_increase".
   */
  path_outer_boundary: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Creeper: 4
   *
   * Sheepomelon: 2
   *
   *
   * Cow: 3
   *
   */
  priority: number;

  /**
   * @remarks
   * This entity will have a 1 in N chance to stop it's current attack,
   * where N = "random_stop_interval".
   */
  random_stop_interval: number;

  /**
   * @remarks
   * Used with the base size of the entity to determine minimum
   * target-distance before trying to deal attack damage.
   */
  reach_multiplier: number;

  /**
   * @remarks
   * Toggles (on/off) the need to have a full path from the entity to
   * the target when using this melee attack behavior.
   */
  require_complete_path: boolean;

  /**
   * @remarks
   * This multiplier modifies the attacking entity's speed when moving
   * toward the target.
   * 
   * Sample Values:
   * Creeper: 1.25
   *
   * Axe Turret: 5
   *
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * Allows the entity to track the attack target, even if the entity
   * has no sensing.
   * 
   * Sample Values:
   * Axe Turret: true
   *
   */
  track_target: boolean;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   * 
   * Sample Values:
   * Axe Turret: 360
   *
   */
  x_max_rotation: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   * 
   * Sample Values:
   * Axe Turret: 360
   *
   */
  y_max_head_rotation: number;

}