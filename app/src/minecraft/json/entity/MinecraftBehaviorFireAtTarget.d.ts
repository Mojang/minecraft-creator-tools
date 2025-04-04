// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.fire_at_target
 * 
 * minecraft:behavior.fire_at_target Samples

Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:behavior.fire_at_target": {
  "projectile_def": "minecraft:breeze_wind_charge_projectile",
  "priority": 2,
  "filters": {
    "all_of": [
      {
        "test": "is_navigating",
        "value": false
      }
    ]
  },
  "attack_range": [
    0,
    16
  ],
  "attack_cooldown": 0.5,
  "pre_shoot_delay": 0.75,
  "post_shoot_delay": 0.2,
  "ranged_fov": 90,
  "owner_anchor": 2,
  "owner_offset": [
    0,
    0.3,
    0
  ],
  "target_anchor": 0,
  "target_offset": [
    0,
    0.5,
    0
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Fire At Target Behavior (minecraft:behavior.fire_at_target)
 * Allows an entity to attack by firing a shot with a delay. Anchor
 * and offset parameters of this component overrides the anchor and
 * offset from projectile component.
 */
export default interface MinecraftBehaviorFireAtTarget {

  /**
   * @remarks
   * The cooldown time in seconds before this goal can be used 
   * again.
   * 
   * Sample Values:
   * Breeze: 0.5
   *
   */
  attack_cooldown: number;

  /**
   * @remarks
   * Target needs to be within this range for the attack to 
   * happen.
   * 
   * Sample Values:
   * Breeze: [0,16]
   *
   */
  attack_range: number[];

  /**
   * @remarks
   * Conditions that need to be met for the behavior to start.
   * 
   * Sample Values:
   * Breeze: {"all_of":[{"test":"is_navigating","value":false}]}
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum head rotation (in degrees), on the X-axis, that this
   * entity can apply while trying to look at the target.
   */
  max_head_rotation_x: number;

  /**
   * @remarks
   * Maximum head rotation (in degrees), on the Y-axis, that this
   * entity can apply while trying to look at the target.
   */
  max_head_rotation_y: number;

  /**
   * @remarks
   * Entity anchor for the projectile spawn location.
   * 
   * Sample Values:
   * Breeze: 2
   *
   */
  owner_anchor: number;

  /**
   * @remarks
   * Offset vector from the owner_anchor.
   * 
   * Sample Values:
   * Breeze: [0,0.3,0]
   *
   */
  owner_offset: number[];

  /**
   * @remarks
   * Time in seconds between firing the projectile and ending the
   * goal.
   * 
   * Sample Values:
   * Breeze: 0.2
   *
   */
  post_shoot_delay: number;

  /**
   * @remarks
   * Time in seconds before firing the projectile.
   * 
   * Sample Values:
   * Breeze: 0.75
   *
   */
  pre_shoot_delay: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Breeze: 2
   *
   */
  priority: number;

  /**
   * @remarks
   * Actor definition to use as projectile for the ranged attack. The
   * actor must be a projectile. This field is required for the goal
   * to be usable.
   * 
   * Sample Values:
   * Breeze: "minecraft:breeze_wind_charge_projectile"
   *
   */
  projectile_def: string;

  /**
   * @remarks
   * Field of view (in degrees) when using sensing to detect a
   * target for attack.
   * 
   * Sample Values:
   * Breeze: 90
   *
   */
  ranged_fov: number;

  /**
   * @remarks
   * Entity anchor for projectile target.
   */
  target_anchor: number;

  /**
   * @remarks
   * Offset vector from the target_anchor.
   * 
   * Sample Values:
   * Breeze: [0,0.5,0]
   *
   */
  target_offset: number[];

}