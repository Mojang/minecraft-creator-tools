// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:destruction_particles
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Destruction Particles (minecraft:destruction_particles)
 * [Note: This component is currently experimental]. Sets the
 * particles that will be used when block is destroyed.
 */
export default interface MinecraftDestructionParticles {

  /**
   * @remarks
   * Optional, number of particles to spawn of destruction. Default is
   * 100, maximum is 255 inclusively
   */
  particle_count?: number;

  /**
   * @remarks
   * The texture name used for the particle.
   */
  texture?: string;

  /**
   * @remarks
   * Tint multiplied to the color. Tint method logic varies, but
   * often refers to the "rain" and "temperature" of the biome the
   * block is placed in to compute the tint.
   */
  tint_method?: string;

}


export enum MinecraftDestructionParticlesTintMethod {
  None = `none`,
  DefaultFoliage = `default_foliage`,
  BirchFoliage = `birch_foliage`,
  EvergreenFoliage = `evergreen_foliage`,
  DryFoliage = `dry_foliage`,
  Grass = `grass`,
  Water = `water`
}