// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:exhaustion_values
 * 
 * minecraft:exhaustion_values Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:exhaustion_values": {
  "heal": 6,
  "jump": 0.05,
  "sprint_jump": 0.2,
  "mine": 0.005,
  "attack": 0.1,
  "damage": 0.1,
  "walk": 0,
  "sprint": 0.1,
  "swim": 0.01
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Exhaustion Values (minecraft:exhaustion_values)
 * Defines how much exhaustion each player action should take.
 */
export default interface MinecraftExhaustionValues {

  /**
   * @remarks
   * Amount of exhaustion applied when attacking.
   * 
   * Sample Values:
   * Player: 0.1
   *
   */
  attack: number;

  /**
   * @remarks
   * Amount of exhaustion applied when taking damage.
   * 
   * Sample Values:
   * Player: 0.1
   *
   */
  damage: number;

  /**
   * @remarks
   * Amount of exhaustion applied when healed through food
   * regeneration.
   * 
   * Sample Values:
   * Player: 6
   *
   */
  heal: number;

  /**
   * @remarks
   * Amount of exhaustion applied when jumping.
   * 
   * Sample Values:
   * Player: 0.05
   *
   */
  jump: number;

  /**
   * @remarks
   * Amount of exhaustion applied when mining.
   * 
   * Sample Values:
   * Player: 0.005
   *
   */
  mine: number;

  /**
   * @remarks
   * Amount of exhaustion applied when sprinting.
   * 
   * Sample Values:
   * Player: 0.1
   *
   */
  sprint: number;

  /**
   * @remarks
   * Amount of exhaustion applied when sprint jumping.
   * 
   * Sample Values:
   * Player: 0.2
   *
   */
  sprint_jump: number;

  /**
   * @remarks
   * Amount of exhaustion applied when swimming.
   * 
   * Sample Values:
   * Player: 0.01
   *
   */
  swim: number;

  /**
   * @remarks
   * Amount of exhaustion applied when walking.
   */
  walk: number;

}