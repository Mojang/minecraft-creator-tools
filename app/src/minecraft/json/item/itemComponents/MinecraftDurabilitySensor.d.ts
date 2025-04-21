// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:durability_sensor
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Durability Sensor (minecraft:durability_sensor)
 * Enables an item to emit effects when it receives damage. Because of
 * this, the item also needs a `minecraft:durability` 
 * component.
 */
export default interface MinecraftDurabilitySensor {

  /**
   * @remarks
   * The effects are emitted when the item durability value is less
   * than or equal to this value.
   */
  durability: number;

  /**
   * @remarks
   * The list of both durability thresholds and effects emitted when
   * each threshold is met. When multiple thresholds are met, only the
   * threshold with the lowest durability after applying the damage is
   * considered.
   */
  durability_thresholds: MinecraftDurabilitySensorDurabilityThresholds[];

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


/**
 * Durability Sensor Durability Threshold (minecraft:durability_sensor 
 * durability_threshold)
 * Defines both the durability threshold, and the effects emitted when
 * that threshold is met.
 */
export interface MinecraftDurabilitySensorDurabilityThresholds {

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