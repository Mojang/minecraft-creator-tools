// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:drying_out_timer
 * 
 * minecraft:drying_out_timer Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:drying_out_timer": {
  "total_time": 300,
  "water_bottle_refill_time": 90,
  "dried_out_event": {
    "event": "dried_out"
  },
  "stopped_drying_out_event": {
    "event": "stop_drying_out"
  },
  "recover_after_dried_out_event": {
    "event": "recover_after_dried_out"
  }
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:drying_out_timer": {
  "total_time": 120,
  "water_bottle_refill_time": 0,
  "dried_out_event": {
    "event": "dried_out"
  },
  "stopped_drying_out_event": {
    "event": "stop_dryingout"
  },
  "recover_after_dried_out_event": {
    "event": "recover_after_dried_out"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Drying Out Timer (minecraft:drying_out_timer)
 * Adds a timer for drying out that will count down and fire
 * 'dried_out_event' or will stop as soon as the entity will get
 * under rain or water and fire 'stopped_drying_out_event'.
 */
export default interface MinecraftDryingOutTimer {

  /**
   * @remarks
   * Event to fire when the drying out time runs out.
   * 
   * Sample Values:
   * Axolotl: {"event":"dried_out"}
   *
   *
   */
  dried_out_event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to fire when entity was already dried out but received increase
   * in water supply.
   * 
   * Sample Values:
   * Axolotl: {"event":"recover_after_dried_out"}
   *
   *
   */
  recover_after_dried_out_event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to fire when entity stopped drying out, for example got
   * into water or under rain.
   * 
   * Sample Values:
   * Axolotl: {"event":"stop_drying_out"}
   *
   * Dolphin: {"event":"stop_dryingout"}
   *
   */
  stopped_drying_out_event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Amount of time in seconds to dry out fully.
   * 
   * Sample Values:
   * Axolotl: 300
   *
   * Dolphin: 120
   *
   */
  total_time?: number;

  /**
   * @remarks
   * Optional amount of additional time in seconds given by using
   * splash water bottle on entity.
   * 
   * Sample Values:
   * Axolotl: 90
   *
   */
  water_bottle_refill_time?: number;

}