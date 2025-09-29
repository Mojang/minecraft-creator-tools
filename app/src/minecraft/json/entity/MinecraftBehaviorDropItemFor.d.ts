// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.drop_item_for
 * 
 * minecraft:behavior.drop_item_for Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.drop_item_for": {
  "priority": 1,
  "seconds_before_pickup": 0,
  "cooldown": 0.25,
  "drop_item_chance": 0.7,
  "offering_distance": 5,
  "minimum_teleport_distance": 2,
  "max_head_look_at_height": 10,
  "target_range": [
    5,
    5,
    5
  ],
  "teleport_offset": [
    0,
    1,
    0
  ],
  "time_of_day_range": [
    0.74999,
    0.8
  ],
  "speed_multiplier": 1,
  "search_range": 5,
  "search_height": 2,
  "search_count": 0,
  "goal_radius": 1,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 6
    }
  ],
  "loot_table": "loot_tables/entities/cat_gift.json",
  "on_drop_attempt": {
    "event": "minecraft:cat_gifted_owner",
    "target": "self"
  }
}


Eliza - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/custom_cat_eliza/behavior_packs/mike_eliz/entities/eliza.json

"minecraft:behavior.drop_item_for": {
  "priority": 1,
  "seconds_before_pickup": 0,
  "cooldown": 0.25,
  "drop_item_chance": 0.7,
  "offering_distance": 5,
  "minimum_teleport_distance": 2,
  "max_head_look_at_height": 10,
  "target_range": [
    5,
    5,
    5
  ],
  "teleport_offset": [
    0,
    1,
    0
  ],
  "time_of_day_range": [
    0.74999,
    0.8
  ],
  "speed_multiplier": 1,
  "search_range": 5,
  "search_height": 2,
  "search_count": 0,
  "goal_radius": 1,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 6
    }
  ],
  "loot_table": "loot_tables/entities/eliza_gift.json",
  "on_drop_attempt": {
    "event": "mike_eliz:eliza_gifted_owner",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Drop Item For Behavior (minecraft:behavior.drop_item_for)
 * Allows the entity to move toward a target, and drop an item near
 * the target.
 */
export default interface MinecraftBehaviorDropItemFor {

  /**
   * @remarks
   * Total time that the goal is on cooldown before it can be used
   * again.
   * 
   * Sample Values:
   * Cat: 0.25
   *
   *
   */
  cooldown?: number;

  /**
   * @remarks
   * The percent chance the entity will drop an item when using this
   * goal.
   * 
   * Sample Values:
   * Cat: 0.7
   *
   *
   */
  drop_item_chance?: number;

  /**
   * @remarks
   * The list of conditions another entity must meet to be a valid
   * target to drop an item for.
   * 
   * Sample Values:
   * Cat: [{"filters":{"test":"is_family","subject":"other","value":"player"},"max_dist":6}]
   *
   *
   */
  entity_types?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Distance in blocks within the entity considers it has reached it's
   * target position.
   * 
   * Sample Values:
   * Cat: 1
   *
   *
   */
  goal_radius?: number;

  /**
   * @remarks
   * The loot table that contains the possible loot the entity can
   * drop with this goal.
   * 
   * Sample Values:
   * Cat: "loot_tables/entities/cat_gift.json"
   *
   * Eliza: "loot_tables/entities/eliza_gift.json"
   *
   */
  loot_table?: string;

  /**
   * @remarks
   * The maximum height the entities head will look at when dropping the
   * item. The entity will always be looking at its target.
   * 
   * Sample Values:
   * Cat: 10
   *
   *
   */
  max_head_look_at_height?: number;

  /**
   * @remarks
   * If the target position is farther away than this distance on
   * any tick, the entity will teleport to the target position.
   * 
   * Sample Values:
   * Cat: 2
   *
   *
   */
  minimum_teleport_distance?: number;

  /**
   * @remarks
   * The preferred distance the entity tries to be from the target it
   * is dropping an item for.
   * 
   * Sample Values:
   * Cat: 5
   *
   *
   */
  offering_distance?: number;

  /**
   * @remarks
   * The event to trigger when the entity attempts to drop an 
   * item.
   * 
   * Sample Values:
   * Cat: {"event":"minecraft:cat_gifted_owner","target":"self"}
   *
   * Eliza: {"event":"mike_eliz:eliza_gifted_owner","target":"self"}
   *
   */
  on_drop_attempt?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Cat: 1
   *
   *
   */
  priority?: number;

  /**
   * @remarks
   * The number of blocks each tick that the entity will check within
   * its search range and height for a valid block to move to. A
   * value of 0 will have the mob check every block within range in
   * one tick.
   */
  search_count?: number;

  /**
   * @remarks
   * The Height in blocks the entity will search within to find a
   * valid target position.
   * 
   * Sample Values:
   * Cat: 2
   *
   *
   */
  search_height?: number;

  /**
   * @remarks
   * The distance in blocks the entity will search within to find a
   * valid target position.
   * 
   * Sample Values:
   * Cat: 5
   *
   *
   */
  search_range?: number;

  /**
   * @remarks
   * The numbers of seconds that will pass before the dropped entity can
   * be picked up from the ground.
   */
  seconds_before_pickup?: number;

  /**
   * @remarks
   * Movement speed multiplier of the entity when using this 
   * Goal.
   * 
   * Sample Values:
   * Cat: 1
   *
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * The range in blocks within which the entity searches to find a
   * target to drop an item for.
   * 
   * Sample Values:
   * Cat: [5,5,5]
   *
   *
   */
  target_range?: number[];

  /**
   * @remarks
   * When the entity teleports, offset the teleport position by this
   * many blocks in the X, Y, and Z coordinate.
   * 
   * Sample Values:
   * Cat: [0,1,0]
   *
   *
   */
  teleport_offset?: number[];

  /**
   * @remarks
   * The valid times of day that this goal can be used. For
   * reference: noon is 0.0, sunset is 0.25, midnight is 0.5, and
   * sunrise is 0.75, and back to noon for 1.0.
   * 
   * Sample Values:
   * Cat: [0.74999,0.8]
   *
   *
   */
  time_of_day_range?: number[];

}