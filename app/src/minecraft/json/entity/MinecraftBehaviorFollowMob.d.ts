// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.follow_mob
 * 
 * minecraft:behavior.follow_mob Samples

Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:behavior.follow_mob": {
  "priority": 4,
  "speed_multiplier": 1,
  "stop_distance": 3,
  "search_range": 20
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Follow Mob Behavior (minecraft:behavior.follow_mob)
 * Allows the mob to follow other mobs.
 */
export default interface MinecraftBehaviorFollowMob {

  /**
   * @remarks
   * If non-empty, provides criteria for filtering which nearby Mobs
   * can be followed. If empty default criteria will be used, which
   * will exclude Players, Squid variants, Fish variants, Tadpoles,
   * Dolphins, and mobs of the same type as the owner of the 
   * Goal.
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The type of actor to prefer following. If left unspecified, a
   * random actor among those in range will be chosen.
   */
  preferred_actor_type: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Parrot: 4
   *
   */
  priority: number;

  /**
   * @remarks
   * The distance in blocks it will look for a mob to follow
   * 
   * Sample Values:
   * Parrot: 20
   *
   */
  search_range: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Parrot: 1
   *
   */
  speed_multiplier: number;

  /**
   * @remarks
   * The distance in blocks this mob stops from the mob it is
   * following
   * 
   * Sample Values:
   * Parrot: 3
   *
   */
  stop_distance: number;

  /**
   * @remarks
   * If true, the mob will respect the 'minecraft:home' component's
   * 'restriction_radius' field when choosing a target to follow. If
   * false, it will choose target position without considering home
   * restrictions.
   */
  use_home_position_restriction: boolean;

}