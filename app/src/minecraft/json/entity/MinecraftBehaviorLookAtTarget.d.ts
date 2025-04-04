// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.look_at_target
 * 
 * minecraft:behavior.look_at_target Samples

Wither - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither.json

"minecraft:behavior.look_at_target": {
  "priority": 5
}


Axe Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/axe_turret.behavior.json

"minecraft:behavior.look_at_target": {
  "priority": 2,
  "look_distance": 12,
  "probability": 1,
  "look_time": [
    1,
    5
  ]
}


Bow Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/bow_turret.behavior.json

"minecraft:behavior.look_at_target": {
  "priority": 1,
  "look_distance": 19,
  "probability": 1,
  "look_time": [
    1,
    5
  ]
}


Crossbow Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/crossbow_turret.behavior.json

"minecraft:behavior.look_at_target": {
  "priority": 1,
  "look_distance": 15,
  "probability": 1,
  "look_time": [
    1,
    5
  ]
}


Shbullet Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/shbullet_turret.behavior.json

"minecraft:behavior.look_at_target": {
  "priority": 1,
  "look_distance": 12,
  "probability": 1,
  "look_time": [
    1,
    5
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Look At Target Behavior (minecraft:behavior.look_at_target)
 * Compels an entity to look at the target by rotating the head bone
 * pose within a set limit.
 */
export default interface MinecraftBehaviorLookAtTarget {

  /**
   * @remarks
   * The angle in degrees that the mob can see in the Y-axis 
   * (up-down).
   */
  angle_of_view_horizontal: number;

  /**
   * @remarks
   * The angle in degrees that the mob can see in the X-axis
   * (left-right).
   */
  angle_of_view_vertical: number;

  /**
   * @remarks
   * The distance in blocks from which the entity will look at this
   * mob's current target.
   * 
   * Sample Values:
   * Axe Turret: 12
   *
   * Bow Turret: 19
   *
   * Crossbow Turret: 15
   *
   */
  look_distance: number;

  /**
   * @remarks
   * Time range to look at this mob's current target.
   * 
   * Sample Values:
   * Axe Turret: [1,5]
   *
   *
   */
  look_time: number[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Wither: 5
   *
   * Axe Turret: 2
   *
   * Bow Turret: 1
   *
   */
  priority: number;

  /**
   * @remarks
   * The probability of looking at the target. A value of 1.00 is
   * 100%.
   * 
   * Sample Values:
   * Axe Turret: 1
   *
   *
   */
  probability: number;

}