// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.ranged_attack
 * 
 * minecraft:behavior.ranged_attack Samples

Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:behavior.ranged_attack": {
  "priority": 3,
  "burst_shots": 3,
  "burst_interval": 0.3,
  "charge_charged_trigger": 0,
  "charge_shoot_trigger": 4,
  "attack_interval_min": 3,
  "attack_interval_max": 5,
  "attack_radius": 16
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.ranged_attack": {
  "priority": 0,
  "attack_interval": 3.5,
  "attack_radius": 15
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.ranged_attack": {
  "priority": 3,
  "attack_interval_min": 1,
  "attack_interval_max": 3,
  "attack_radius": 10,
  "swing": true
}


Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ghast.json

"minecraft:behavior.ranged_attack": {
  "priority": 1,
  "attack_radius": 64,
  "charge_shoot_trigger": 2,
  "charge_charged_trigger": 1
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

 * At /minecraft:entity/component_groups/minecraft:llama_angry/minecraft:behavior.ranged_attack/: 
"minecraft:behavior.ranged_attack": {
  "priority": 2,
  "attack_radius": 64,
  "charge_shoot_trigger": 2,
  "charge_charged_trigger": 1
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.ranged_attack": {
  "priority": 8,
  "attack_interval_min": 1,
  "attack_interval_max": 1,
  "attack_radius": 8,
  "attack_radius_min": 4,
  "speed_multiplier": 1,
  "target_in_sight_time": 0.1
}


Pillager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pillager.json

"minecraft:behavior.ranged_attack": {
  "priority": 4,
  "attack_interval_min": 1,
  "attack_interval_max": 1,
  "attack_radius": 8
}


Shulker - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/shulker.json

"minecraft:behavior.ranged_attack": {
  "attack_interval_min": 1,
  "attack_interval_max": 3,
  "attack_radius": 15
}


Snow Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snow_golem.json

"minecraft:behavior.ranged_attack": {
  "priority": 1,
  "speed_multiplier": 1.25,
  "attack_interval": 1,
  "attack_radius": 10
}


Witch - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/witch.json

"minecraft:behavior.ranged_attack": {
  "priority": 2,
  "speed_multiplier": 1,
  "attack_interval_min": 3,
  "attack_interval_max": 3,
  "attack_radius": 10
}


Bow Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/bow_turret.behavior.json

"minecraft:behavior.ranged_attack": {
  "attack_interval_min": 2.4,
  "attack_interval_max": 3.8,
  "attack_radius": 19,
  "ranged_fov": 360,
  "y_max_head_rotation": 360,
  "x_max_rotation": 360
}


Crossbow Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/crossbow_turret.behavior.json

"minecraft:behavior.ranged_attack": {
  "attack_interval_min": 0.4,
  "attack_interval_max": 0.8,
  "attack_radius": 15,
  "ranged_fov": 360,
  "y_max_head_rotation": 360,
  "x_max_rotation": 360
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Ranged Attack Behavior (minecraft:behavior.ranged_attack)
 * Allows an entity to attack by using ranged shots.
 * "charge_shoot_trigger" must be greater than 0 to enable charged up
 * burst-shot attacks. Requires minecraft:shooter to define projectile
 * behaviour.
 */
export default interface MinecraftBehaviorRangedAttack {

  /**
   * @remarks
   * Alternative to "attack_interval_min" & "attack_interval_max". Consistent
   * reload-time (in seconds), when not using a charged shot. Does not
   * scale with target-distance.
   * 
   * Sample Values:
   * Bogged: 3.5
   *
   * Snow Golem: 1
   *
   */
  attack_interval: number;

  /**
   * @remarks
   * Maximum bound for reload-time range (in seconds), when not using a
   * charged shot. Reload-time range scales with target-distance.
   * 
   * Sample Values:
   * Blaze: 5
   *
   * Drowned: 3
   *
   * Piglin: 1
   *
   */
  attack_interval_max: number;

  /**
   * @remarks
   * Minimum bound for reload-time range (in seconds), when not using a
   * charged shot. Reload-time range scales with target-distance.
   * 
   * Sample Values:
   * Blaze: 3
   *
   * Drowned: 1
   *
   *
   *
   * Bow Turret: 2.4
   *
   */
  attack_interval_min: number;

  /**
   * @remarks
   * Minimum distance to target before this entity will attempt to
   * shoot.
   * 
   * Sample Values:
   * Blaze: 16
   *
   * Bogged: 15
   *
   * Drowned: 10
   *
   */
  attack_radius: number;

  /**
   * @remarks
   * Minimum distance the target can be for this mob to fire. If the
   * target is closer, this mob will move first before firing
   * 
   * Sample Values:
   * Piglin: 4
   *
   */
  attack_radius_min: number;

  /**
   * @remarks
   * Time (in seconds) between each individual shot when firing a
   * burst of shots from a charged up attack.
   * 
   * Sample Values:
   * Blaze: 0.3
   *
   */
  burst_interval: number;

  /**
   * @remarks
   * Number of shots fired every time the attacking entity uses a
   * charged up attack.
   * 
   * Sample Values:
   * Blaze: 3
   *
   */
  burst_shots: number;

  /**
   * @remarks
   * Time (in seconds, then add "charge_shoot_trigger"), before a
   * charged up attack is done charging. Charge-time decays while
   * target is not in sight.
   * 
   * Sample Values:
   * Ghast: 1
   *
   *
   */
  charge_charged_trigger: number;

  /**
   * @remarks
   * Amount of time (in seconds, then doubled) a charged shot must be
   * charging before reloading burst shots. Charge-time decays while
   * target is not in sight.
   * 
   * Sample Values:
   * Blaze: 4
   *
   * Ghast: 2
   *
   *
   */
  charge_shoot_trigger: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Blaze: 3
   *
   *
   * Ghast: 1
   *
   * Llama: 2
   *
   */
  priority: number;

  /**
   * @remarks
   * Field of view (in degrees) when using sensing to detect a
   * target for attack.
   * 
   * Sample Values:
   * Bow Turret: 360
   *
   *
   */
  ranged_fov: number;

  /**
   * @remarks
   * Allows the actor to be set to persist upon targeting a 
   * player
   */
  set_persistent: boolean;

  /**
   * @remarks
   * During attack behavior, this multiplier modifies the entity's speed
   * when moving toward the target.
   * 
   * Sample Values:
   * Piglin: 1
   *
   * Snow Golem: 1.25
   *
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * If a swing animation (using variable.attack_time) exists, this
   * causes the actor to swing their arm(s) upon firing the ranged
   * attack.
   * 
   * Sample Values:
   * Drowned: true
   *
   */
  swing: boolean;

  /**
   * @remarks
   * Minimum amount of time (in seconds) the attacking entity needs to
   * see the target before moving toward it.
   * 
   * Sample Values:
   * Piglin: 0.1
   *
   */
  target_in_sight_time: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   * 
   * Sample Values:
   * Bow Turret: 360
   *
   *
   */
  x_max_rotation: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   * 
   * Sample Values:
   * Bow Turret: 360
   *
   *
   */
  y_max_head_rotation: number;

}