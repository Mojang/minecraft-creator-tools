// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:raid_trigger
 * 
 * minecraft:raid_trigger Samples

Player - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/player.json

"minecraft:raid_trigger": {
  "minecraft:raid_trigger": {
    "triggered_event": {
      "event": "minecraft:remove_raid_trigger",
      "target": "self"
    }
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Raid Trigger (minecraft:raid_trigger)
 * Attempts to trigger a raid at the entity's location.
 */
export default interface MinecraftRaidTrigger {

  /**
   * @remarks
   * 
   * Sample Values:
   * Player: {"triggered_event":{"event":"minecraft:remove_raid_trigger","target":"self"}}
   *
   */
  "minecraft:raid_trigger": MinecraftRaidTriggerMinecraftRaidTrigger;

  /**
   * @remarks
   * Event to run when a raid is triggered on the village.
   */
  triggered_event: jsoncommon.MinecraftEventTrigger;

}


/**
 * Minecraft:raid_trigger (minecraft:raid_trigger)
 */
export interface MinecraftRaidTriggerMinecraftRaidTrigger {

  /**
   * @remarks
   * 
   * Sample Values:
   * Player: {"event":"minecraft:remove_raid_trigger","target":"self"}
   *
   */
  triggered_event: string;

}