// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:projectile
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Projectile (minecraft:projectile)
 * Allows the entity to be a thrown entity.
 */
export default interface MinecraftProjectile {

  /**
   * @remarks
   * Determines the angle at which the projectile is thrown
   */
  angle_offset?: number;

  /**
   * @remarks
   * If true, the entity hit will be set on fire
   */
  catch_fire?: boolean;

  /**
   * @remarks
   * If true, the projectile will produce additional particles when a
   * critical hit happens
   */
  crit_particle_on_hurt?: boolean;

  /**
   * @remarks
   * If true, this entity will be destroyed when hit
   */
  destroy_on_hurt?: boolean;

  /**
   * @remarks
   * Entity Definitions defined here can't be hurt by the 
   * projectile
   */
  filter?: string;

  /**
   * @remarks
   * If true, whether the projectile causes fire is affected by the
   * mob griefing game rule
   */
  fire_affected_by_griefing?: boolean;

  /**
   * @remarks
   * The gravity applied to this entity when thrown. The higher the
   * value, the faster the entity falls
   */
  gravity?: number;

  /**
   * @remarks
   * If true, when hitting a vehicle, and there's at least one
   * passenger in the vehicle, the damage will be dealt to the
   * passenger closest to the projectile impact point. If there are
   * no passengers, this setting does nothing.
   */
  hit_nearest_passenger?: boolean;

  /**
   * @remarks
   * The sound that plays when the projectile hits something
   */
  hit_sound?: string;

  /**
   * @remarks
   * If true, the projectile homes in to the nearest entity
   */
  homing?: boolean;

  /**
   * @remarks
   * [EXPERIMENTAL] An array of strings defining the types of
   * entities that this entity does not collide with.
   */
  ignored_entities?: string[];

  /**
   * @remarks
   * The fraction of the projectile's speed maintained every frame
   * while traveling in air
   */
  inertia?: number;

  /**
   * @remarks
   * If true, the projectile will be treated as dangerous to the
   * players
   */
  is_dangerous?: boolean;

  /**
   * @remarks
   * If true, the projectile will knock back the entity it hits
   */
  knockback?: boolean;

  /**
   * @remarks
   * If true, the entity hit will be struck by lightning
   */
  lightning?: boolean;

  /**
   * @remarks
   * The fraction of the projectile's speed maintained every frame
   * while traveling in water
   */
  liquid_inertia?: number;

  /**
   * @remarks
   * If true, the projectile can hit multiple entities per flight
   */
  multiple_targets?: boolean;

  /**
   * @remarks
   * The offset from the entity's anchor where the projectile will
   * spawn
   */
  offset?: number[];

  /**
   * @remarks
   * Time in seconds that the entity hit will be on fire for
   */
  on_fire_time?: number;

  /**
   * @remarks
   * Particle to use upon collision
   */
  particle?: string;

  /**
   * @remarks
   * Defines the effect the arrow will apply to the entity it 
   * hits
   */
  potion_effect?: number;

  /**
   * @remarks
   * Determines the velocity of the projectile
   */
  power?: number;

  /**
   * @remarks
   * During the specified time, in seconds, the projectile cannot be
   * reflected by hitting it
   */
  reflect_immunity?: number;

  /**
   * @remarks
   * If true, this entity will be reflected back when hit
   */
  reflect_on_hurt?: boolean;

  /**
   * @remarks
   * If true, damage will be randomized based on damage and speed
   */
  semi_random_diff_damage?: boolean;

  /**
   * @remarks
   * The sound that plays when the projectile is shot
   */
  shoot_sound?: string;

  /**
   * @remarks
   * If true, the projectile will be shot towards the target of the
   * entity firing it
   */
  shoot_target?: boolean;

  /**
   * @remarks
   * If true, the projectile will bounce upon hit
   */
  should_bounce?: boolean;

  /**
   * @remarks
   * If true, the projectile will be treated like a splash potion
   */
  splash_potion?: boolean;

  /**
   * @remarks
   * Radius in blocks of the 'splash' effect
   */
  splash_range?: number;

  /**
   * @remarks
   * The base accuracy. Accuracy is determined by the formula
   * uncertaintyBase - difficultyLevel * uncertaintyMultiplier
   */
  uncertainty_base?: number;

  /**
   * @remarks
   * Determines how much difficulty affects accuracy. Accuracy is
   * determined by the formula uncertaintyBase - difficultyLevel *
   * uncertaintyMultiplier
   */
  uncertainty_multiplier?: number;

}