// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:game_event_movement_tracking
 * 
 * minecraft:game_event_movement_tracking Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:game_event_movement_tracking": {
  "emit_flap": true
}


Vex - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/vex.json

"minecraft:game_event_movement_tracking": {
  "emit_move": false,
  "emit_swim": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Game Event Movement Tracking 
 * (minecraft:game_event_movement_tracking)
 * Allows an entity to emit `entityMove`, `swim` and `flap` game
 * events, depending on the block the entity is moving through. It
 * is added by default to every mob. Add it again to override its
 * behavior.
 */
export default interface MinecraftGameEventMovementTracking {

  /**
   * @remarks
   * If true, the `flap` game event will be emitted when the entity
   * moves through air.
   * 
   * Sample Values:
   * Allay: true
   *
   *
   */
  emit_flap?: boolean;

  /**
   * @remarks
   * If true, the `entityMove` game event will be emitted when the
   * entity moves on ground or through a solid.
   */
  emit_move?: boolean;

  /**
   * @remarks
   * If true, the `swim` game event will be emitted when the entity
   * moves through a liquid.
   */
  emit_swim?: boolean;

}