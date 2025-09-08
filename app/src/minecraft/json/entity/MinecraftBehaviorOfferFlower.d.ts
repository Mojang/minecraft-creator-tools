// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.offer_flower
 * 
 * minecraft:behavior.offer_flower Samples

Iron Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/iron_golem.json

"minecraft:behavior.offer_flower": {
  "priority": 5,
  "filters": {
    "test": "is_daytime"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Offer Flower Behavior (minecraft:behavior.offer_flower)
 * Allows the mob to offer a flower to another mob with the
 * minecraft:take_flower behavior.
 * Note: Requires a flower item to be held by the entity.
 */
export default interface MinecraftBehaviorOfferFlower {

  /**
   * @remarks
   * Percent chance that the mob will start this goal from 0.0 to
   * 1.0 (where 1.0 = 100%).
   */
  chance_to_start?: number;

  /**
   * @remarks
   * Conditions that need to be met for the behavior to start.
   * 
   * Sample Values:
   * Iron Golem: {"test":"is_daytime"}
   *
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the Y-axis, this entity can
   * rotate its head while trying to look at the target.
   */
  max_head_rotation_y?: number;

  /**
   * @remarks
   * The max amount of time (in seconds) that the mob will offer the
   * flower for before exiting the Goal.
   */
  max_offer_flower_duration?: number;

  /**
   * @remarks
   * Maximum rotation (in degrees), on the X-axis, this entity can
   * rotate while trying to look at the target.
   */
  max_rotation_x?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Iron Golem: 5
   *
   */
  priority?: number;

  /**
   * @remarks
   * The dimensions of the AABB used to search for a potential mob to
   * offer flower to.
   */
  search_area?: number[];

}