// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:durability_sensor_durability_threshold
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Durability Sensor Durability Threshold
 * Defines both the durability threshold, and the effects emitted when
 * that threshold is met.
 */
export default interface DurabilitySensorDurabilityThreshold {

  /**
   * @remarks
   * The effects are emitted when the item durability value is less
   * than or equal to this value.
   */
  durability: number;

  /**
   * @remarks
   * Particle effect to emit when the threshold is met.
   */
  particle_type: string;

  /**
   * @remarks
   * Sound effect to emit when the threshold is met.
   */
  sound_event: string;

}