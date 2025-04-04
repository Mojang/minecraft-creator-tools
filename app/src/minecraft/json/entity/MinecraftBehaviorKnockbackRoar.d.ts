// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.knockback_roar
 * 
 * minecraft:behavior.knockback_roar Samples

Ravager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ravager.json

"minecraft:behavior.knockback_roar": {
  "priority": 1,
  "duration": 1,
  "attack_time": 0.5,
  "knockback_damage": 6,
  "knockback_horizontal_strength": 3,
  "knockback_vertical_strength": 3,
  "knockback_range": 4,
  "knockback_filters": {
    "test": "is_family",
    "subject": "other",
    "operator": "!=",
    "value": "ravager"
  },
  "damage_filters": {
    "test": "is_family",
    "subject": "other",
    "operator": "!=",
    "value": "illager"
  },
  "on_roar_end": {
    "event": "minecraft:end_roar"
  },
  "cooldown_time": 0.1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Knockback Roar Behavior (minecraft:behavior.knockback_roar)
 * Allows the mob to perform a damaging knockback that affects all
 * nearby entities.
 */
export default interface MinecraftBehaviorKnockbackRoar {

  /**
   * @remarks
   * The delay after which the knockback occurs (in seconds).
   * 
   * Sample Values:
   * Ravager: 0.5
   *
   */
  attack_time: number;

  /**
   * @remarks
   * Time (in seconds) the mob has to wait before using the goal
   * again.
   * 
   * Sample Values:
   * Ravager: 0.1
   *
   */
  cooldown_time: number;

  /**
   * @remarks
   * The list of conditions another entity must meet to be a valid
   * target to apply damage to.
   * 
   * Sample Values:
   * Ravager: {"test":"is_family","subject":"other","operator":"!=","value":"illager"}
   *
   */
  damage_filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The max duration of the roar (in seconds).
   * 
   * Sample Values:
   * Ravager: 1
   *
   */
  duration: number;

  /**
   * @remarks
   * The damage dealt by the knockback roar.
   * 
   * Sample Values:
   * Ravager: 6
   *
   */
  knockback_damage: number;

  /**
   * @remarks
   * The list of conditions another entity must meet to be a valid
   * target to apply knockback to.
   * 
   * Sample Values:
   * Ravager: {"test":"is_family","subject":"other","operator":"!=","value":"ravager"}
   *
   */
  knockback_filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The maximum height for vertical knockback.
   */
  knockback_height_cap: number;

  /**
   * @remarks
   * The strength of the horizontal knockback.
   * 
   * Sample Values:
   * Ravager: 3
   *
   */
  knockback_horizontal_strength: number;

  /**
   * @remarks
   * The radius (in blocks) of the knockback effect.
   * 
   * Sample Values:
   * Ravager: 4
   *
   */
  knockback_range: number;

  /**
   * @remarks
   * The strength of the vertical knockback.
   * 
   * Sample Values:
   * Ravager: 3
   *
   */
  knockback_vertical_strength: number;

  /**
   * @remarks
   * Event that is triggered when the roar ends.
   * 
   * Sample Values:
   * Ravager: {"event":"minecraft:end_roar"}
   *
   */
  on_roar_end: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Ravager: 1
   *
   */
  priority: number;

}