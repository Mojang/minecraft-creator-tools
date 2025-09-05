// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.eat_mob
 * 
 * minecraft:behavior.eat_mob Samples

Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.eat_mob": {
  "priority": 7,
  "run_speed": 2,
  "eat_animation_time": 0.3,
  "pull_in_force": 0.75,
  "reach_mob_distance": 1.75,
  "eat_mob_sound": "tongue",
  "loot_table": "loot_tables/entities/frog.json"
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Eat Mob Behavior (minecraft:behavior.eat_mob)
 * Allows the entity to eat a specified Mob.
 */
export default interface MinecraftBehaviorEatMob {

  /**
   * @remarks
   * Sets the time in seconds the eat animation should play for.
   * 
   * Sample Values:
   * Frog: 0.3
   *
   */
  eat_animation_time?: number;

  /**
   * @remarks
   * Sets the sound that should play when eating a mob.
   * 
   * Sample Values:
   * Frog: "tongue"
   *
   */
  eat_mob_sound?: string;

  /**
   * @remarks
   * The loot table for loot to be dropped when eating a mob.
   * 
   * Sample Values:
   * Frog: "loot_tables/entities/frog.json"
   *
   */
  loot_table?: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Frog: 7
   *
   */
  priority?: number;

  /**
   * @remarks
   * Sets the force which the mob-to-be-eaten is pulled towards the
   * eating mob.
   * 
   * Sample Values:
   * Frog: 0.75
   *
   */
  pull_in_force?: number;

  /**
   * @remarks
   * Sets the desired distance to be reached before eating the 
   * mob.
   * 
   * Sample Values:
   * Frog: 1.75
   *
   */
  reach_mob_distance?: number;

  /**
   * @remarks
   * Sets the entity's speed when running toward the target.
   * 
   * Sample Values:
   * Frog: 2
   *
   */
  run_speed?: number;

}