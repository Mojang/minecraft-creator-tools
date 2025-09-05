// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:queued_ticking
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Queued Ticking (minecraft:queued_ticking)
 * Triggers the specified event, either once, or at a regular interval
 * equal to a number of ticks randomly chosen from the
 * interval_range provided.
 * IMPORTANT
 * This type is now deprecated, and no longer in use in the latest versions of Minecraft.
 * 
 */
export default interface MinecraftQueuedTicking {

  /**
   * @remarks
   * A range of values, specified in ticks, that will be used to
   * decide the interval between times this event triggers. Each
   * interval will be chosen randomly from the range, so the times
   * between this event triggering will differ given an
   * interval_range of two different values. If the values in the
   * interval_range are the same, the event will always be triggered after
   * that number of ticks.
   */
  interval_range?: string[];

  /**
   * @remarks
   * Does the event loop? If false, the event will only be triggered once,
   * after a delay equal to a number of ticks randomly chosen from the
   * interval_range. If true, the event will loop, and each interval
   * between events will be equal to a number of ticks randomly chosen
   * from the interval_range.
   */
  looping?: boolean;

  /**
   * @remarks
   * The event that will be triggered once or on an interval.
   */
  on_tick?: jsoncommon.MinecraftEventTrigger;

}