// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.take_flower
 * 
 * minecraft:behavior.take_flower Samples

Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.take_flower": {
  "priority": 9,
  "filters": {
    "all_of": [
      {
        "test": "is_daytime",
        "value": true
      }
    ]
  }
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.take_flower": {
  "priority": 7,
  "filters": {
    "all_of": [
      {
        "test": "is_daytime",
        "value": true
      }
    ]
  }
}


Beachager - https://github.com/microsoft/minecraft-samples/tree/main/chill_oasis_blocks_and_features/chill_oasis_assets/behavior_packs/chill_oasis_assets/entities/beachager.behavior.json

"minecraft:behavior.take_flower": {
  "priority": 9
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Take Flower Behavior (minecraft:behavior.take_flower)
 * Allows the mob to accept flowers from another mob with the
 * minecraft:offer_flower behavior.
 */
export default interface MinecraftBehaviorTakeFlower {

  /**
   * @remarks
   * Conditions that need to be met for the behavior to start.
   * 
   * Sample Values:
   * Villager v2: {"all_of":[{"test":"is_daytime","value":true}]}
   *
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   */
  max_head_rotation_y: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   */
  max_rotation_x: number;

  /**
   * @remarks
   * The maximum amount of time (in seconds) for the mob to randomly wait
   * for before taking the flower.
   */
  max_wait_time: number;

  /**
   * @remarks
   * Minimum distance (in blocks) for the entity to be considered having
   * reached its target.
   */
  min_distance_to_target: number;

  /**
   * @remarks
   * The minimum amount of time (in seconds) for the mob to randomly wait
   * for before taking the flower.
   */
  min_wait_time: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Villager v2: 9
   *
   * Villager: 7
   *
   *
   */
  priority: number;

  /**
   * @remarks
   * The dimensions of the AABB used to search for a potential mob to
   * take a flower from.
   */
  search_area: number[];

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI 
   * Goal.
   */
  speed_multiplier: number;

}