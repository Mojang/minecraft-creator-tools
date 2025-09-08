// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.pickup_items
 * 
 * minecraft:behavior.pickup_items Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:behavior.pickup_items": {
  "priority": 2,
  "max_dist": 32,
  "search_height": 32,
  "goal_radius": 2.2,
  "speed_multiplier": 6,
  "pickup_based_on_chance": false,
  "can_pickup_any_item": false,
  "can_pickup_to_hand_or_equipment": false,
  "pickup_same_items_as_in_hand": true
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.pickup_items": {
  "priority": 5,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1,
  "pickup_based_on_chance": true,
  "can_pickup_any_item": true
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.pickup_items": {
  "priority": 6,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1,
  "pickup_based_on_chance": true,
  "can_pickup_any_item": true,
  "excluded_items": [
    "minecraft:glow_ink_sac"
  ]
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:behavior.pickup_items": {
  "priority": 7,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.pickup_items": {
  "priority": 11,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 0.5
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.pickup_items": {
  "priority": 6,
  "max_dist": 10,
  "goal_radius": 2,
  "speed_multiplier": 0.8,
  "pickup_based_on_chance": false,
  "can_pickup_any_item": false,
  "cooldown_after_being_attacked": 20
}


Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager.json

"minecraft:behavior.pickup_items": {
  "priority": 9,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 0.5,
  "can_pickup_to_hand_or_equipment": false
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

"minecraft:behavior.pickup_items": {
  "priority": 4,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 0.5,
  "can_pickup_to_hand_or_equipment": false
}


Wither Skeleton - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither_skeleton.json

"minecraft:behavior.pickup_items": {
  "priority": 5,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1,
  "pickup_based_on_chance": true
}


Zombie Pigman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_pigman.json

"minecraft:behavior.pickup_items": {
  "priority": 6,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1,
  "pickup_based_on_chance": true,
  "can_pickup_any_item": true
}


Zombie Villager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_villager.json

"minecraft:behavior.pickup_items": {
  "priority": 8,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1,
  "pickup_based_on_chance": false,
  "can_pickup_any_item": true,
  "excluded_items": [
    "minecraft:glow_ink_sac"
  ]
}


Zombie Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_villager_v2.json

"minecraft:behavior.pickup_items": {
  "priority": 8,
  "max_dist": 3,
  "goal_radius": 2,
  "speed_multiplier": 1,
  "pickup_based_on_chance": true,
  "can_pickup_any_item": true,
  "excluded_items": [
    "minecraft:glow_ink_sac"
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Pickup Items Behavior (minecraft:behavior.pickup_items)
 * Allows the mob to pick up items on the ground.
 */
export default interface MinecraftBehaviorPickupItems {

  /**
   * @remarks
   * If true, the mob can pickup any item
   * 
   * Sample Values:
   * Bogged: true
   *
   *
   */
  can_pickup_any_item?: boolean;

  /**
   * @remarks
   * If true, the mob can pickup items to its hand or armor slots
   */
  can_pickup_to_hand_or_equipment?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Piglin: 20
   *
   */
  cooldown_after_being_attacked?: number;

  /**
   * @remarks
   * List of items this mob will not pick up
   * 
   * Sample Values:
   * Drowned: ["minecraft:glow_ink_sac"]
   *
   *
   */
  excluded_items?: string[];

  /**
   * @remarks
   * Distance in blocks within the mob considers it has reached the
   * goal. This is the "wiggle room" to stop the AI from bouncing back
   * and forth trying to reach a specific spot
   * 
   * Sample Values:
   * Allay: 2.2
   *
   * Bogged: 2
   *
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * Maximum distance this mob will look for items to pick up
   * 
   * Sample Values:
   * Allay: 32
   *
   * Bogged: 3
   *
   *
   * Piglin: 10
   *
   */
  max_dist?: number;

  /**
   * @remarks
   * If true, depending on the difficulty, there is a random chance that
   * the mob may not be able to pickup items
   * 
   * Sample Values:
   * Bogged: true
   *
   *
   */
  pickup_based_on_chance?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: true
   *
   */
  pickup_same_items_as_in_hand?: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Allay: 2
   *
   * Bogged: 5
   *
   * Drowned: 6
   *
   */
  priority?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: 32
   *
   */
  search_height?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Allay: 6
   *
   * Bogged: 1
   *
   *
   * Fox: 0.5
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * If true, this mob will chase after the target as long as it's a
   * valid target
   */
  track_target?: boolean;

}