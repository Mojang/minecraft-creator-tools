// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.investigate_suspicious_location
 * 
 * minecraft:behavior.investigate_suspicious_location Samples

Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:behavior.investigate_suspicious_location": {
  "priority": 5,
  "speed_multiplier": 0.7
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Investigate Suspicious Location Behavior
 * (minecraft:behavior.investigate_suspicious_location)
 * Allows this entity to move towards a "suspicious" position based
 * on data gathered in `minecraft:suspect_tracking`.
 */
export default interface MinecraftBehaviorInvestigateSuspiciousLocation {

  /**
   * @remarks
   * Distance in blocks within the entity considers it has reached it's
   * target position.
   */
  goal_radius?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Warden: 5
   *
   */
  priority?: number;

  /**
   * @remarks
   * Movement speed multiplier
   * 
   * Sample Values:
   * Warden: 0.7
   *
   */
  speed_multiplier?: number;

}