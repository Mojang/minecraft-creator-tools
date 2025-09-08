// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.sniff
 * 
 * minecraft:behavior.sniff Samples

Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:behavior.sniff": {
  "priority": 6,
  "duration": 4.16,
  "sniffing_radius": 24,
  "suspicion_radius_horizontal": 6,
  "suspicion_radius_vertical": 20,
  "cooldown_range": [
    5,
    10
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Sniff Behavior (minecraft:behavior.sniff)
 * Allows this entity to detect the nearest player within
 * "sniffing_radius" and update its "minecraft:suspect_tracking" component
 * state.
 */
export default interface MinecraftBehaviorSniff {

  /**
   * @remarks
   * Cooldown range between sniffs in seconds
   * 
   * Sample Values:
   * Warden: [5,10]
   *
   */
  cooldown_range?: number[];

  /**
   * @remarks
   * Sniffing duration in seconds
   * 
   * Sample Values:
   * Warden: 4.16
   *
   */
  duration?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Warden: 6
   *
   */
  priority?: number;

  /**
   * @remarks
   * Mob detection radius
   * 
   * Sample Values:
   * Warden: 24
   *
   */
  sniffing_radius?: number;

  /**
   * @remarks
   * Mob suspicion horizontal radius. When a player is within this
   * radius horizontally, the anger level towards that player is
   * increased
   * 
   * Sample Values:
   * Warden: 6
   *
   */
  suspicion_radius_horizontal?: number;

  /**
   * @remarks
   * Mob suspicion vertical radius. When a player is within this
   * radius vertically, the anger level towards that player is
   * increased
   * 
   * Sample Values:
   * Warden: 20
   *
   */
  suspicion_radius_vertical?: number;

}