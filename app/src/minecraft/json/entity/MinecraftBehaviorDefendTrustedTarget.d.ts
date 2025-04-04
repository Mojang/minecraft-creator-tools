// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.defend_trusted_target
 * 
 * minecraft:behavior.defend_trusted_target Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.defend_trusted_target": {
  "priority": 0,
  "within_radius": 25,
  "must_see": false,
  "aggro_sound": "mad",
  "sound_chance": 0.05,
  "on_defend_start": {
    "event": "minecraft:fox_configure_defending",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Defend Trusted Target Behavior
 * (minecraft:behavior.defend_trusted_target)
 * Allows the mob to target another mob that hurts an entity it
 * trusts.
 * Note: Requires a mob to be set to a trusted relationship in
 * order for the behavior to work properly. The `minecraft:trust` component
 * will set the entity state to trusted.
 */
export default interface MinecraftBehaviorDefendTrustedTarget {

  /**
   * @remarks
   * Sound to occasionally play while defending.
   * 
   * Sample Values:
   * Fox: "mad"
   *
   */
  aggro_sound: string;

  /**
   * @remarks
   * Time in seconds between attacks
   */
  attack_interval: number;

  /**
   * @remarks
   * List of entity types that this mob considers valid targets
   */
  entity_types: MinecraftBehaviorDefendTrustedTargetEntityTypes[];

  /**
   * @remarks
   * If true, only entities in this mob's viewing range can be
   * selected as targets
   */
  must_see: boolean;

  /**
   * @remarks
   * Determines the amount of time in seconds that this mob will look
   * for a target before forgetting about it and looking for a new
   * one when the target isn't visible any more
   */
  must_see_forget_duration: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: {"event":"minecraft:fox_configure_defending","target":"self"}
   *
   */
  on_defend_start: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   */
  priority: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: 0.05
   *
   */
  sound_chance: number;

  /**
   * @remarks
   * Distance in blocks that the target can be within to launch an
   * attack
   * 
   * Sample Values:
   * Fox: 25
   *
   */
  within_radius: number;

}


/**
 * List of entity types that this mob considers valid targets.
 */
export interface MinecraftBehaviorDefendTrustedTargetEntityTypes {

  /**
   * @remarks
   * The amount of time in seconds that the mob has to wait before
   * selecting a target of the same type again
   */
  cooldown: number;

  /**
   * @remarks
   * Conditions that make this entry in the list valid
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum distance this mob can be away to be a valid choice
   */
  max_dist: number;

  /**
   * @remarks
   * If true, the mob has to be visible to be a valid choice
   */
  must_see: boolean;

  /**
   * @remarks
   * Determines the amount of time in seconds that this mob will look
   * for a target before forgetting about it and looking for a new
   * one when the target isn't visible any more
   */
  must_see_forget_duration: number;

  /**
   * @remarks
   * If true, the mob will stop being targeted if it stops meeting any
   * conditions.
   */
  reevaluate_description: boolean;

  /**
   * @remarks
   * Multiplier for the running speed. A value of 1.0 means the speed
   * is unchanged
   */
  sprint_speed_multiplier: number;

  /**
   * @remarks
   * Multiplier for the walking speed. A value of 1.0 means the speed
   * is unchanged
   */
  walk_speed_multiplier: number;

}