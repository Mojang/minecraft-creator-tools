// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.ram_attack
 * 
 * minecraft:behavior.ram_attack Samples

Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

 * At /minecraft:entity/component_groups/ram_default/minecraft:behavior.ram_attack/: 
"minecraft:behavior.ram_attack": {
  "priority": 5,
  "run_speed": 0.7,
  "ram_speed": 1.8,
  "min_ram_distance": 4,
  "ram_distance": 7,
  "knockback_force": 2.5,
  "knockback_height": 0.04,
  "pre_ram_sound": "pre_ram",
  "ram_impact_sound": "ram_impact",
  "cooldown_range": [
    30,
    300
  ],
  "on_start": [
    {
      "event": "start_event",
      "target": "self"
    }
  ]
}

 * At /minecraft:entity/component_groups/ram_screamer/minecraft:behavior.ram_attack/: 
"minecraft:behavior.ram_attack": {
  "priority": 5,
  "run_speed": 0.7,
  "ram_speed": 1.8,
  "min_ram_distance": 4,
  "ram_distance": 7,
  "knockback_force": 2.5,
  "knockback_height": 0.04,
  "pre_ram_sound": "pre_ram.screamer",
  "ram_impact_sound": "ram_impact.screamer",
  "cooldown_range": [
    5,
    15
  ],
  "on_start": [
    {
      "event": "start_event",
      "target": "self"
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Ram Attack Behavior (minecraft:behavior.ram_attack)
 * Allows this entity to damage a target by using a running 
 * attack.
 */
export default interface MinecraftBehaviorRamAttack {

  /**
   * @remarks
   * The modifier to knockback that babies have.
   */
  baby_knockback_modifier: number;

  /**
   * @remarks
   * Minimum and maximum cooldown time-range (positive, in seconds)
   * between each attempted ram attack.
   * 
   * Sample Values:
   * Goat: [30,300], [5,15]
   *
   */
  cooldown_range: number[];

  /**
   * @remarks
   * The force of the knockback of the ram attack.
   * 
   * Sample Values:
   * Goat: 2.5
   *
   */
  knockback_force: number;

  /**
   * @remarks
   * The height of the knockback of the ram attack.
   * 
   * Sample Values:
   * Goat: 0.04
   *
   */
  knockback_height: number;

  /**
   * @remarks
   * The minimum distance at which the mob can start a ram 
   * attack.
   * 
   * Sample Values:
   * Goat: 4
   *
   */
  min_ram_distance: number;

  /**
   * @remarks
   * The event to trigger when attacking
   * 
   * Sample Values:
   * Goat: [{"event":"start_event","target":"self"}]
   *
   */
  on_start: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The sound to play when an entity is about to perform a ram
   * attack.
   * 
   * Sample Values:
   * Goat: "pre_ram", "pre_ram.screamer"
   *
   */
  pre_ram_sound: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Goat: 5
   *
   */
  priority: number;

  /**
   * @remarks
   * The distance at which the mob start to run with ram speed.
   * 
   * Sample Values:
   * Goat: 7
   *
   */
  ram_distance: number;

  /**
   * @remarks
   * The sound to play when an entity is impacting on a ram 
   * attack.
   * 
   * Sample Values:
   * Goat: "ram_impact", "ram_impact.screamer"
   *
   */
  ram_impact_sound: string;

  /**
   * @remarks
   * Sets the entity's speed when charging toward the target.
   * 
   * Sample Values:
   * Goat: 1.8
   *
   */
  ram_speed: number;

  /**
   * @remarks
   * Sets the entity's speed when running toward the target.
   * 
   * Sample Values:
   * Goat: 0.7
   *
   */
  run_speed: number;

}