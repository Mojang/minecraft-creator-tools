// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.melee_box_attack
 * 
 * minecraft:behavior.melee_box_attack Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.melee_box_attack": {
  "priority": 4,
  "on_kill": {
    "event": "killed_enemy_event",
    "target": "self"
  }
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.melee_box_attack": {
  "priority": 2,
  "attack_once": true,
  "speed_multiplier": 1.4,
  "on_attack": {
    "event": "countdown_to_perish_event",
    "target": "self"
  }
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:behavior.melee_box_attack": {
  "priority": 3
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.melee_box_attack": {
  "priority": 4,
  "track_target": true,
  "speed_multiplier": 1.25
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_hostile/minecraft:behavior.melee_box_attack/: 
"minecraft:behavior.melee_box_attack": {
  "priority": 3,
  "track_target": true,
  "random_stop_interval": 100
}

 * At /minecraft:entity/component_groups/minecraft:spider_angry/minecraft:behavior.melee_box_attack/: 
"minecraft:behavior.melee_box_attack": {
  "priority": 3,
  "track_target": true
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:behavior.melee_box_attack": {
  "priority": 2,
  "cooldown_time": 2
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.melee_box_attack": {
  "priority": 2,
  "track_target": true
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.melee_box_attack": {
  "can_spread_on_fire": true,
  "priority": 3,
  "speed_multiplier": 1,
  "track_target": false,
  "require_complete_path": true
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:behavior.melee_box_attack": {
  "priority": 2
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:docile_fox/minecraft:behavior.melee_box_attack/: 
"minecraft:behavior.melee_box_attack": {
  "priority": 10,
  "track_target": true,
  "require_complete_path": true
}

 * At /minecraft:entity/component_groups/minecraft:defending_fox/minecraft:behavior.melee_box_attack/: 
"minecraft:behavior.melee_box_attack": {
  "priority": 1,
  "track_target": true,
  "require_complete_path": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Melee Box Attack Behavior 
 * (minecraft:behavior.melee_box_attack)
 * Allows an entity to deal damage through a melee attack with reach
 * calculations based on bounding boxes.
 */
export default interface MinecraftBehaviorMeleeBoxAttack {

  /**
   * @remarks
   * Allows the entity to use this attack behavior, only once 
   * EVER.
   * 
   * Sample Values:
   * Bee: true
   *
   *
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
   * 
   * Sample Values:
   * Drowned: true
   *
   *
   */
  can_spread_on_fire?: boolean;

  /**
   * @remarks
   * Cooldown time (in seconds) between attacks.
   * 
   * Sample Values:
   * Creaking: 2
   *
   * Hoglin: 0.75
   *
   */
  cooldown_time?: number;

  /**
   * @remarks
   * The attack reach of the mob will be a box with the size of the
   * mobs bounds increased by this value in all horizontal 
   * directions.
   */
  horizontal_reach?: number;

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
   * 
   * Sample Values:
   * Warden: 360
   *
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
   * 
   * Sample Values:
   * Bee: {"event":"countdown_to_perish_event","target":"self"}
   *
   */
  on_attack?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Defines the event to trigger when this entity kills the 
   * target.
   * 
   * Sample Values:
   * Axolotl: {"event":"killed_enemy_event","target":"self"}
   *
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
   * Axolotl: 4
   *
   * Bee: 2
   *
   * Blaze: 3
   *
   */
  priority?: number;

  /**
   * @remarks
   * This entity will have a 1 in N chance to stop it's current attack,
   * where N = "random_stop_interval".
   * 
   * Sample Values:
   * Cave Spider: 100
   *
   */
  random_stop_interval?: number;

  /**
   * @remarks
   * Toggles (on/off) the need to have a full path from the entity to
   * the target when using this melee attack behavior.
   * 
   * Sample Values:
   * Drowned: true
   *
   *
   */
  require_complete_path?: boolean;

  /**
   * @remarks
   * This multiplier modifies the attacking entity's speed when moving
   * toward the target.
   * 
   * Sample Values:
   * Bee: 1.4
   *
   * Bogged: 1.25
   *
   * Drowned: 1
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * Allows the entity to track the attack target, even if the entity
   * has no sensing.
   * 
   * Sample Values:
   * Bogged: true
   *
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