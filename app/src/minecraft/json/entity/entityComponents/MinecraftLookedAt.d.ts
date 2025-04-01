// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:looked_at
 * 
 * minecraft:looked_at Samples

Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:neutral/minecraft:looked_at/: 
"minecraft:looked_at": {
  "search_radius": 12,
  "look_at_locations": [
    {
      "location": "head"
    },
    {
      "location": "body"
    },
    {
      "location": "feet",
      "vertical_offset": 0.5
    }
  ],
  "set_target": "once_and_keep_scanning",
  "find_players_only": true,
  "looked_at_cooldown": 0.1,
  "field_of_view": 120,
  "scale_fov_by_distance": false,
  "line_of_sight_obstruction_type": "collision_for_camera",
  "looked_at_event": {
    "event": "minecraft:become_hostile",
    "filter": "self"
  },
  "filters": {
    "test": "actor_health",
    "subject": "other",
    "operator": ">",
    "value": 0
  }
}

 * At /minecraft:entity/component_groups/minecraft:hostile/minecraft:looked_at/: 
"minecraft:looked_at": {
  "search_radius": 24,
  "look_at_locations": [
    {
      "location": "head"
    },
    {
      "location": "body"
    },
    {
      "location": "feet",
      "vertical_offset": 0.5
    }
  ],
  "set_target": "never",
  "find_players_only": true,
  "looked_at_cooldown": 0.1,
  "field_of_view": 120,
  "scale_fov_by_distance": false,
  "line_of_sight_obstruction_type": "collision_for_camera",
  "looked_at_event": {
    "event": "minecraft:on_target_start_looking",
    "filter": "self"
  },
  "not_looked_at_event": {
    "event": "minecraft:on_target_stop_looking",
    "filter": "self"
  },
  "filters": {
    "none_of": [
      {
        "test": "actor_health",
        "subject": "target",
        "value": 0
      },
      {
        "test": "has_equipment",
        "subject": "other",
        "domain": "head",
        "value": "carved_pumpkin"
      }
    ]
  }
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:looked_at": {
  "search_radius": 64,
  "set_target": "once_and_stop_scanning",
  "find_players_only": true,
  "min_looked_at_duration": 0.25,
  "filters": {
    "test": "has_equipment",
    "domain": "head",
    "subject": "other",
    "operator": "not",
    "value": "carved_pumpkin"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Looked At (minecraft:looked_at)
 * Defines the behavior when another entity looks at the owner
 * entity.
 */
export default interface MinecraftLookedAt {

  /**
   * @remarks
   * Defines, in degrees, the width of the field of view for entities
   * looking at the owner entity. If "scale_fov_by_distance" is set
   * to true, this value corresponds to the field of view at a
   * distance of one block between the entities.
   * 
   * Sample Values:
   * Creaking: 120
   *
   */
  field_of_view: number;

  /**
   * @remarks
   * Defines which entities are considered when searching for
   * entities looking at the owner entity.
   * 
   * Sample Values:
   * Creaking: {"test":"actor_health","subject":"other","operator":">","value":0}, {"none_of":[{"test":"actor_health","subject":"target","value":0},{"test":"has_equipment","subject":"other","domain":"head","value":"carved_pumpkin"}]}
   *
   * Enderman: {"test":"has_equipment","domain":"head","subject":"other","operator":"not","value":"carved_pumpkin"}
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Limits the search to only the nearest Player that meets the
   * specified "filters" rather than all nearby entities.
   * 
   * Sample Values:
   * Creaking: true
   *
   */
  find_players_only: boolean;

  /**
   * @remarks
   * Defines the type of block shape used to check for line of sight
   * obstructions. Valid values: "outline", "collision",
   * "collision_for_camera".
   * 
   * Sample Values:
   * Creaking: "collision_for_camera"
   *
   */
  line_of_sight_obstruction_type: string;

  /**
   * @remarks
   * A list of locations on the owner entity towards which line of
   * sight checks are performed. At least one location must be
   * unobstructed for the entity to be considered as looked at.
   * 
   * Sample Values:
   * Creaking: [{"location":"head"},{"location":"body"},{"location":"feet","vertical_offset":0.5}]
   *
   */
  look_at_locations: string[];

  /**
   * @remarks
   * Specifies the range for the random number of seconds that must
   * pass before the owner entity can check again for entities looking at
   * it, after detecting an entity looking at it.
   * 
   * Sample Values:
   * Creaking: 0.1
   *
   */
  looked_at_cooldown: number[];

  /**
   * @remarks
   * Defines the event to trigger when an entity is detected looking at
   * the owner entity.
   * 
   * Sample Values:
   * Creaking: {"event":"minecraft:become_hostile","filter":"self"}, {"event":"minecraft:on_target_start_looking","filter":"self"}
   *
   */
  looked_at_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Defines the minimum, continuous time the owner entity has to be
   * looked at before being considered as such. Defaults to 0 if not
   * explicitly specified.
   * 
   * Sample Values:
   * Enderman: 0.25
   *
   */
  min_looked_at_duration: number;

  /**
   * @remarks
   * Defines the event to trigger when no entity is found looking at
   * the owner entity.
   * 
   * Sample Values:
   * Creaking: {"event":"minecraft:on_target_stop_looking","filter":"self"}
   *
   */
  not_looked_at_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * When true, the field of view narrows as the distance between the
   * owner entity and the entity looking at it increases. This ensures
   * that the width of the view cone remains somewhat constant towards
   * the owner entity position, regardless of distance.
   */
  scale_fov_by_distance: boolean;

  /**
   * @remarks
   * Maximum distance the owner entity will search for entities looking
   * at it.
   * 
   * Sample Values:
   * Creaking: 12, 24
   *
   * Enderman: 64
   *
   */
  search_radius: number;

  /**
   * @remarks
   * Defines if and how the owner entity will set entities that are
   * looking at it as its combat targets. Valid values:
         
   *                                 \n- "never", looking entities are
   * never set as targets, but events are emitted.
              
   *                            \n- "once_and_stop_scanning", the
   * first detected looking entity is set as target. Scanning and
   * event emission is suspended if and until the owner entity has a
   * target.
                                          \n-
   * "once_and_keep_scanning", the first detected looking entity is
   * set as target. Scanning and event emission continues.s
   * 
   * Sample Values:
   * Creaking: "once_and_keep_scanning", "never"
   *
   * Enderman: "once_and_stop_scanning"
   *
   */
  set_target: boolean;

}