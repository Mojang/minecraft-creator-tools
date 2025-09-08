// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.vex_copy_owner_target
 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Vex Copy Owner Target Behavior
 * (minecraft:behavior.vex_copy_owner_target)
 * Allows the mob to target the same entity its owner is
 * targeting.
 * Note: No longer used for the `vex` entity.
 */
export default interface MinecraftBehaviorVexCopyOwnerTarget {

  /**
   * @remarks
   * List of entities this mob can copy the owner from
   */
  entity_types?: MinecraftBehaviorVexCopyOwnerTargetEntityTypes[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority?: number;

}


/**
 * List of entities this mob can copy the owner from.
 */
export interface MinecraftBehaviorVexCopyOwnerTargetEntityTypes {

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