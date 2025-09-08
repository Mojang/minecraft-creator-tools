// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.place_block
 * 
 * minecraft:behavior.place_block Samples

Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:behavior.place_block": {
  "priority": 1,
  "xz_range": 0,
  "y_range": 0,
  "chance": 0.0058,
  "can_place": {
    "test": "bool_property",
    "domain": "minecraft:is_becoming_statue",
    "value": false
  },
  "randomly_placeable_blocks": [
    {
      "block": {
        "name": "minecraft:oxidized_copper_golem_statue",
        "states": {
          "minecraft:cardinal_direction": "north"
        }
      },
      "filter": {
        "any_of": [
          {
            "all_of": [
              {
                "test": "y_rotation",
                "operator": ">=",
                "value": 135
              },
              {
                "test": "y_rotation",
                "operator": "<",
                "value": 180
              }
            ]
          },
          {
            "all_of": [
              {
                "test": "y_rotation",
                "operator": ">=",
                "value": -180
              },
              {
                "test": "y_rotation",
                "operator": "<",
                "value": -135
              }
            ]
          }
        ]
      }
    },
    {
      "block": {
        "name": "minecraft:oxidized_copper_golem_statue",
        "states": {
          "minecraft:cardinal_direction": "east"
        }
      },
      "filter": {
        "all_of": [
          {
            "test": "y_rotation",
            "operator": ">=",
            "value": -135
          },
          {
            "test": "y_rotation",
            "operator": "<",
            "value": -45
          }
        ]
      }
    },
    {
      "block": {
        "name": "minecraft:oxidized_copper_golem_statue",
        "states": {
          "minecraft:cardinal_direction": "south"
        }
      },
      "filter": {
        "all_of": [
          {
            "test": "y_rotation",
            "operator": ">=",
            "value": -45
          },
          {
            "test": "y_rotation",
            "operator": "<",
            "value": 45
          }
        ]
      }
    },
    {
      "block": {
        "name": "minecraft:oxidized_copper_golem_statue",
        "states": {
          "minecraft:cardinal_direction": "west"
        }
      },
      "filter": {
        "all_of": [
          {
            "test": "y_rotation",
            "operator": ">=",
            "value": 45
          },
          {
            "test": "y_rotation",
            "operator": "<",
            "value": 135
          }
        ]
      }
    }
  ],
  "affected_by_griefing_rule": false,
  "on_place": {
    "event": "minecraft:become_statue",
    "target": "self"
  }
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:behavior.place_block": {
  "priority": 10,
  "xz_range": [
    -1,
    1
  ],
  "y_range": [
    0,
    2
  ],
  "chance": 0.0005
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Place Block Behavior (minecraft:behavior.place_block)
 */
export default interface MinecraftBehaviorPlaceBlock {

  /**
   * @remarks
   * If true, whether the goal is affected by the mob griefing game
   * rule.
   */
  affected_by_griefing_rule?: boolean;

  /**
   * @remarks
   * Filters for if the entity should try to place its block. Self and
   * Target are set.
   * 
   * Sample Values:
   * Copper Golem: {"test":"bool_property","domain":"minecraft:is_becoming_statue","value":false}
   *
   */
  can_place?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Chance each tick for the entity to try and place a block.
   * 
   * Sample Values:
   * Copper Golem: 0.0058
   *
   * Enderman: 0.0005
   *
   */
  chance?: number;

  /**
   * @remarks
   * Trigger ran if the entity does place its block. Self, Target, and
   * Block are set.
   * 
   * Sample Values:
   * Copper Golem: {"event":"minecraft:become_statue","target":"self"}
   *
   */
  on_place?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Block descriptors for which blocks are valid to be placed from
   * the entity's carried item, if empty all blocks are valid.
   */
  placeable_carried_blocks?: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Copper Golem: 1
   *
   * Enderman: 10
   *
   */
  priority?: number;

  /**
   * @remarks
   * Weighted block descriptors for which blocks should be randomly
   * placed, if empty the entity will try to place its carried block
   * from placeable_carried_blocks.
   * 
   * Sample Values:
   * Copper Golem: [{"block":{"name":"minecraft:oxidized_copper_golem_statue","states":{"minecraft:cardinal_direction":"north"}},"filter":{"any_of":[{"all_of":[{"test":"y_rotation","operator":">=","value":135},{"test":"y_rotation","operator":"<","value":180}]},{"all_of":[{"test":"y_rotation","operator":">=","value":-180},{"test":"y_rotation","operator":"<","value":-135}]}]}},{"block":{"name":"minecraft:oxidized_copper_golem_statue","states":{"minecraft:cardinal_direction":"east"}},"filter":{"all_of":[{"test":"y_rotation","operator":">=","value":-135},{"test":"y_rotation","operator":"<","value":-45}]}},{"block":{"name":"minecraft:oxidized_copper_golem_statue","states":{"minecraft:cardinal_direction":"south"}},"filter":{"all_of":[{"test":"y_rotation","operator":">=","value":-45},{"test":"y_rotation","operator":"<","value":45}]}},{"block":{"name":"minecraft:oxidized_copper_golem_statue","states":{"minecraft:cardinal_direction":"west"}},"filter":{"all_of":[{"test":"y_rotation","operator":">=","value":45},{"test":"y_rotation","operator":"<","value":135}]}}]
   *
   */
  randomly_placeable_blocks?: string[];

  /**
   * @remarks
   * XZ range from which the entity will try and place blocks in.
   * 
   * Sample Values:
   * Enderman: [-1,1]
   *
   */
  xz_range?: number[];

  /**
   * @remarks
   * Y range from which the entity will try and place blocks in.
   * 
   * Sample Values:
   * Enderman: [0,2]
   *
   */
  y_range?: number[];

}