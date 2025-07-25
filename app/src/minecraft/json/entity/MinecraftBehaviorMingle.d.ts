// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.mingle
 * 
 * minecraft:behavior.mingle Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/job_specific_goals/minecraft:behavior.mingle/: 
"minecraft:behavior.mingle": {}

 * At /minecraft:entity/component_groups/gather_schedule_villager/minecraft:behavior.mingle/: 
"minecraft:behavior.mingle": {
  "priority": 7,
  "speed_multiplier": 0.5,
  "duration": 30,
  "cooldown_time": 10,
  "mingle_partner_type": "minecraft:villager_v2",
  "mingle_distance": 2
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Mingle Behavior (minecraft:behavior.mingle)
 * Allows an entity to go to the village bell and mingle with other
 * entities.
 */
export default interface MinecraftBehaviorMingle {

  /**
   * @remarks
   * Time in seconds the mob has to wait before using the goal 
   * again
   * 
   * Sample Values:
   * Villager v2: 10
   *
   */
  cooldown_time: number;

  /**
   * @remarks
   * Amount of time in seconds that the entity will chat with another
   * entity
   * 
   * Sample Values:
   * Villager v2: 30
   *
   */
  duration: number;

  /**
   * @remarks
   * The distance from its partner that this entity will mingle. If
   * the entity type is not the same as the entity, this value needs to
   * be identical on both entities.
   * 
   * Sample Values:
   * Villager v2: 2
   *
   */
  mingle_distance: number;

  /**
   * @remarks
   * The entity type that this entity is allowed to mingle with
   * 
   * Sample Values:
   * Villager v2: "minecraft:villager_v2"
   *
   */
  mingle_partner_type: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 7
   *
   */
  priority: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Villager v2: 0.5
   *
   */
  speed_multiplier: number;

}