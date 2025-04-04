// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:trusting
 * 
 * minecraft:trusting Samples

Ocelot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ocelot.json

"minecraft:trusting": {
  "probability": 0.33,
  "trust_items": [
    "fish",
    "salmon"
  ],
  "trust_event": {
    "event": "minecraft:on_trust",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Trusting (minecraft:trusting)
 * Defines the rules for a mob to trust players.
 */
export default interface MinecraftTrusting {

  /**
   * @remarks
   * The chance of the entity trusting with each item use between 0.0
   * and 1.0, where 1.0 is 100%.
   * 
   * Sample Values:
   * Ocelot: 0.33
   *
   */
  probability: number;

  /**
   * @remarks
   * Event to run when this entity becomes trusting.
   * 
   * Sample Values:
   * Ocelot: {"event":"minecraft:on_trust","target":"self"}
   *
   */
  trust_event: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The list of items that can be used to get the entity to trust
   * players.
   * 
   * Sample Values:
   * Ocelot: ["fish","salmon"]
   *
   */
  trust_items: string[];

}