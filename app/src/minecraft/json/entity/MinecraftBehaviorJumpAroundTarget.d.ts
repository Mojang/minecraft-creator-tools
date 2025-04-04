// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.jump_around_target
 * 
 * minecraft:behavior.jump_around_target Samples

Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:behavior.jump_around_target": {
  "priority": 5,
  "filters": {
    "all_of": [
      {
        "any_of": [
          {
            "test": "in_water",
            "value": true
          },
          {
            "test": "on_ground",
            "value": true
          }
        ]
      },
      {
        "test": "is_riding",
        "value": false
      },
      {
        "test": "in_lava",
        "value": false
      }
    ]
  },
  "jump_cooldown_duration": 0.5,
  "jump_cooldown_when_hurt_duration": 0.1,
  "last_hurt_duration": 2,
  "prepare_jump_duration": 0.5,
  "max_jump_velocity": 1.4,
  "check_collision": false,
  "entity_bounding_box_scale": 0.7,
  "line_of_sight_obstruction_height_ignore": 4,
  "valid_distance_to_target": [
    4,
    20
  ],
  "landing_position_spread_degrees": 90,
  "landing_distance_from_target": [
    4,
    8
  ],
  "required_vertical_space": 4,
  "snap_to_surface_block_range": 10,
  "jump_angles": [
    40,
    55,
    60,
    75,
    80
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Jump Around Target Behavior 
 * (minecraft:behavior.jump_around_target)
 * Allows an entity to jump around a target.
 */
export default interface MinecraftBehaviorJumpAroundTarget {

  /**
   * @remarks
   * Enables collision checks when calculating the jump. Setting
   * check_collision to true may affect performance and should be
   * used with care.
   */
  check_collision: boolean;

  /**
   * @remarks
   * Scaling temporarily applied to the entity's AABB bounds when
   * jumping. A smaller bounding box reduces the risk of collisions during
   * the jump. When check_collision is true it also increases the
   * chance of being able to jump when close to obstacles.
   * 
   * Sample Values:
   * Breeze: 0.7
   *
   */
  entity_bounding_box_scale: number;

  /**
   * @remarks
   * Conditions that need to be met for the behavior to start.
   * 
   * Sample Values:
   * Breeze: {"all_of":[{"any_of":[{"test":"in_water","value":true},{"test":"on_ground","value":true}]},{"test":"is_riding","value":false},{"test":"in_lava","value":false}]}
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The jump angles in float degrees that are allowed when performing the
   * jump. The order in which the angles are chosen is 
   * randomized.
   * 
   * Sample Values:
   * Breeze: [40,55,60,75,80]
   *
   */
  jump_angles: string[];

  /**
   * @remarks
   * The time in seconds to spend in cooldown before this goal can be
   * used again.
   * 
   * Sample Values:
   * Breeze: 0.5
   *
   */
  jump_cooldown_duration: number;

  /**
   * @remarks
   * The time in seconds to spend in cooldown after being hurt before
   * this goal can be used again.
   * 
   * Sample Values:
   * Breeze: 0.1
   *
   */
  jump_cooldown_when_hurt_duration: number;

  /**
   * @remarks
   * The range deciding how close to and how far away from the target
   * the landing position can be when jumping.
   * 
   * Sample Values:
   * Breeze: [4,8]
   *
   */
  landing_distance_from_target: number[];

  /**
   * @remarks
   * This angle (in degrees) is used for controlling the spread when
   * picking a landing position behind the target. A zero spread angle
   * means the landing position will be straight behind the target with
   * no variance. A 90 degree spread angle means the landing position can
   * be up to 45 degrees to the left and to the right of the position
   * straight behind the target's view direction.
   * 
   * Sample Values:
   * Breeze: 90
   *
   */
  landing_position_spread_degrees: number;

  /**
   * @remarks
   * If the entity was hurt within these last seconds, the
   * jump_cooldown_when_hurt_duration will be used instead of
   * jump_cooldown_duration.
   * 
   * Sample Values:
   * Breeze: 2
   *
   */
  last_hurt_duration: number;

  /**
   * @remarks
   * If the entity's line of sight towards its target is obstructed by
   * an obstacle with a height below this number, the obstacle will be
   * ignored, and the goal will try to find a valid landing 
   * position.
   * 
   * Sample Values:
   * Breeze: 4
   *
   */
  line_of_sight_obstruction_height_ignore: number;

  /**
   * @remarks
   * Maximum velocity a jump can be performed at.
   * 
   * Sample Values:
   * Breeze: 1.4
   *
   */
  max_jump_velocity: number;

  /**
   * @remarks
   * The time in seconds to spend preparing for the jump.
   * 
   * Sample Values:
   * Breeze: 0.5
   *
   */
  prepare_jump_duration: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Breeze: 5
   *
   */
  priority: number;

  /**
   * @remarks
   * The number of blocks above the entity's head that has to be air
   * for this goal to be usable.
   * 
   * Sample Values:
   * Breeze: 4
   *
   */
  required_vertical_space: number;

  /**
   * @remarks
   * The number of blocks above and below from the jump target position
   * that will be checked to find a surface to land on.
   * 
   * Sample Values:
   * Breeze: 10
   *
   */
  snap_to_surface_block_range: number;

  /**
   * @remarks
   * Target needs to be within this range for the jump to happen.
   * 
   * Sample Values:
   * Breeze: [4,20]
   *
   */
  valid_distance_to_target: number[];

}