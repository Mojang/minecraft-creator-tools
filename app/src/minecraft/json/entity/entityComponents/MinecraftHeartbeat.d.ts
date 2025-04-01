// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:heartbeat
 * 
 * minecraft:heartbeat Samples

Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:heartbeat": {
  "interval": "2.0 - math.clamp(query.anger_level / 80 * 1.5, 0, 1.5)"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Heartbeat (minecraft:heartbeat)
 * Defines the entity's heartbeat.
 */
export default interface MinecraftHeartbeat {

  /**
   * @remarks
   * A Molang expression defining the inter-beat interval in
   * seconds. A value of zero or less means no heartbeat.
   * 
   * Sample Values:
   * Warden: "2.0 - math.clamp(query.anger_level / 80 * 1.5, 0, 1.5)"
   *
   */
  interval: string;

  /**
   * @remarks
   * Level sound event to be played as the heartbeat sound.
   */
  sound_event: jsoncommon.MinecraftEventTrigger;

}