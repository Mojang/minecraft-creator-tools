// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.play_dead
 * 
 * minecraft:behavior.play_dead Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.play_dead": {
  "priority": 0,
  "duration": 10,
  "force_below_health": 8,
  "random_start_chance": 0.33,
  "random_damage_range": [
    0,
    2
  ],
  "damage_sources": [
    "contact",
    "entity_attack",
    "entity_explosion",
    "magic",
    "projectile",
    "thorns",
    "wither"
  ],
  "apply_regeneration": true,
  "filters": {
    "test": "in_water",
    "operator": "==",
    "value": true
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Play Dead Behavior (minecraft:behavior.play_dead)
 * Allows this entity to pretend to be dead to avoid being targeted by
 * attackers.
 */
export default interface MinecraftBehaviorPlayDead {

  /**
   * @remarks
   * Whether the mob will receive the regeneration effect while playing
   * dead.
   * 
   * Sample Values:
   * Axolotl: true
   *
   */
  apply_regeneration: boolean;

  /**
   * @remarks
   * The list of Entity Damage Sources that will cause this mob to
   * play dead.
   * 
   * Sample Values:
   * Axolotl: ["contact","entity_attack","entity_explosion","magic","projectile","thorns","wither"]
   *
   */
  damage_sources: string[];

  /**
   * @remarks
   * The amount of time the mob will remain playing dead (in
   * seconds).
   * 
   * Sample Values:
   * Axolotl: 10
   *
   */
  duration: number;

  /**
   * @remarks
   * The list of other triggers that are required for the mob to
   * activate play dead
   * 
   * Sample Values:
   * Axolotl: {"test":"in_water","operator":"==","value":true}
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The amount of health at which damage will cause the mob to play
   * dead.
   * 
   * Sample Values:
   * Axolotl: 8
   *
   */
  force_below_health: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

  /**
   * @remarks
   * The range of damage that may cause the goal to start depending on
   * randomness. Damage taken below the min will never cause the goal
   * to start. Damage taken above the max will always cause the goal
   * to start.
   * 
   * Sample Values:
   * Axolotl: [0,2]
   *
   */
  random_damage_range: number[];

  /**
   * @remarks
   * The likelihood of this goal starting upon taking damage.
   * 
   * Sample Values:
   * Axolotl: 0.33
   *
   */
  random_start_chance: number;

}