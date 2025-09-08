// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.nearest_prioritized_attackable_target
 * 
 * minecraft:behavior.nearest_prioritized_attackable_target Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:fox_red/minecraft:behavior.nearest_prioritized_attackable_target/: 
"minecraft:behavior.nearest_prioritized_attackable_target": {
  "priority": 6,
  "attack_interval": 2,
  "reselect_targets": true,
  "target_search_height": 5,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "rabbit"
      },
      "max_dist": 12,
      "priority": 0
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "chicken"
      },
      "max_dist": 12,
      "priority": 0
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "cod"
      },
      "max_dist": 12,
      "priority": 1
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "salmon"
      },
      "max_dist": 12,
      "priority": 1
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "tropicalfish"
      },
      "max_dist": 12,
      "priority": 1
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "baby_turtle"
          },
          {
            "test": "in_water",
            "subject": "other",
            "operator": "!=",
            "value": true
          }
        ]
      },
      "max_dist": 12,
      "priority": 0
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:fox_arctic/minecraft:behavior.nearest_prioritized_attackable_target/: 
"minecraft:behavior.nearest_prioritized_attackable_target": {
  "priority": 6,
  "attack_interval": 2,
  "reselect_targets": true,
  "target_search_height": 5,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "rabbit"
      },
      "max_dist": 12,
      "priority": 1
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "chicken"
      },
      "max_dist": 12,
      "priority": 1
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "cod"
      },
      "max_dist": 12,
      "priority": 0
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "salmon"
      },
      "max_dist": 12,
      "priority": 0
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "tropicalfish"
      },
      "max_dist": 12,
      "priority": 0
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "baby_turtle"
          },
          {
            "test": "in_water",
            "subject": "other",
            "operator": "!=",
            "value": true
          }
        ]
      },
      "max_dist": 12,
      "priority": 1
    }
  ]
}


Piglin Brute - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin_brute.json

"minecraft:behavior.nearest_prioritized_attackable_target": {
  "priority": 3,
  "within_radius": 12,
  "persist_time": 2,
  "must_see": true,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 12,
      "priority": 0
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "wither"
      },
      "max_dist": 12,
      "priority": 1
    }
  ]
}


Witch - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/witch.json

"minecraft:behavior.nearest_prioritized_attackable_target": {
  "priority": 2,
  "entity_types": [
    {
      "filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "snowgolem"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "irongolem"
          }
        ]
      },
      "priority": 1,
      "max_dist": 10
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_raider",
            "subject": "other",
            "value": true
          },
          {
            "test": "is_raider",
            "subject": "self",
            "value": true
          },
          {
            "none_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "witch"
              }
            ]
          }
        ]
      },
      "priority": 2,
      "cooldown": 10,
      "max_dist": 10
    }
  ],
  "must_reach": true
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Nearest Prioritized Attackable Target Behavior
 * (minecraft:behavior.nearest_prioritized_attackable_target)
 * Allows the mob to check for and pursue the nearest valid 
 * target.
 */
export default interface MinecraftBehaviorNearestPrioritizedAttackableTarget {

  /**
   * @remarks
   * Time in seconds before selecting a target
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  attack_interval?: number;

  /**
   * @remarks
   * The amount of time in seconds that the mob has to wait before
   * selecting a target of the same type again
   */
  cooldown?: number;

  /**
   * @remarks
   * List of entity types that this mob considers valid targets
   * 
   * Sample Values:
   * Fox: [{"filters":{"test":"is_family","subject":"other","value":"rabbit"},"max_dist":12,"priority":0},{"filters":{"test":"is_family","subject":"other","value":"chicken"},"max_dist":12,"priority":0},{"filters":{"test":"is_family","subject":"other","value":"cod"},"max_dist":12,"priority":1},{"filters":{"test":"is_family","subject":"other","value":"salmon"},"max_dist":12,"priority":1},{"filters":{"test":"is_family","subject":"other","value":"tropicalfish"},"max_dist":12,"priority":1},{"filters":{"all_of":[{"test":"is_family","subject":"other","value":"baby_turtle"},{"test":"in_water","subject":"other","operator":"!=","value":true}]},"max_dist":12,"priority":0}]
   *
   */
  entity_types?: MinecraftBehaviorNearestPrioritizedAttackableTargetEntityTypes[];

  /**
   * @remarks
   * If true, only entities that this mob can path to can be
   * selected as targets
   */
  must_reach?: boolean;

  /**
   * @remarks
   * If true, only entities in this mob's viewing range can be
   * selected as targets
   */
  must_see?: boolean;

  /**
   * @remarks
   * Determines the amount of time in seconds that this mob will look
   * for a target before forgetting about it and looking for a new
   * one when the target isn't visible any more
   */
  must_see_forget_duration?: number;

  /**
   * @remarks
   * Time in seconds for a valid target to stay targeted when it
   * becomes and invalid target.
   */
  persist_time?: number;

  /**
   * @remarks
   * Specifies the priority in which filtered enemy types should be
   * attacked. Lower number means higher priority.
   */
  priority?: number;

  /**
   * @remarks
   * If true, the target will change to the current closest entity
   * whenever a different entity is closer
   */
  reselect_targets?: boolean;

  /**
   * @remarks
   * How many ticks to wait between scanning for a target.
   */
  scan_interval?: number;

  /**
   * @remarks
   * Allows the actor to be set to persist upon targeting a 
   * player
   */
  set_persistent?: boolean;

  /**
   * @remarks
   * Height in blocks to search for a target mob. -1.0f means the
   * height does not matter.
   */
  target_search_height?: number;

  /**
   * @remarks
   * Distance in blocks that the target can be within to launch an
   * attack
   */
  within_radius?: number;

}


/**
 * List of entity types that this mob considers valid targets.
 */
export interface MinecraftBehaviorNearestPrioritizedAttackableTargetEntityTypes {

  /**
   * @remarks
   * The amount of time in seconds that the mob has to wait before
   * selecting a target of the same type again
   */
  cooldown?: number;

  /**
   * @remarks
   * Conditions that make this entry in the list valid
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum distance this mob can be away to be a valid choice
   */
  max_dist?: number;

  /**
   * @remarks
   * If true, the mob has to be visible to be a valid choice
   */
  must_see?: boolean;

  /**
   * @remarks
   * Determines the amount of time in seconds that this mob will look
   * for a target before forgetting about it and looking for a new
   * one when the target isn't visible any more
   */
  must_see_forget_duration?: number;

  priority?: number;

  /**
   * @remarks
   * If true, the mob will stop being targeted if it stops meeting any
   * conditions.
   */
  reevaluate_description?: boolean;

  /**
   * @remarks
   * Multiplier for the running speed. A value of 1.0 means the speed
   * is unchanged
   */
  sprint_speed_multiplier?: number;

  /**
   * @remarks
   * Multiplier for the walking speed. A value of 1.0 means the speed
   * is unchanged
   */
  walk_speed_multiplier?: number;

}