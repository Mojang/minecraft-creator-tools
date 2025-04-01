// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement.fly
 * 
 * minecraft:movement.fly Samples

Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:movement.fly": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Fly Movement (minecraft:movement.fly)
 * This move control causes the mob to fly.
 */
export default interface MinecraftMovementFly {

  /**
   * @remarks
   * The maximum number in degrees the mob can turn per tick.
   */
  max_turn: number;

  /**
   * @remarks
   * Speed that the mob adjusts to when it has to turn quickly.
   */
  speed_when_turning: number;

  /**
   * @remarks
   * Initial speed of the mob when it starts gliding.
   */
  start_speed: number;

}