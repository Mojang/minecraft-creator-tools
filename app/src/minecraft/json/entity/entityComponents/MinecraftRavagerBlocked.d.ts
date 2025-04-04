// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:ravager_blocked
 * 
 * minecraft:ravager_blocked Samples

Ravager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ravager.json

"minecraft:ravager_blocked": {
  "knockback_strength": 3,
  "reaction_choices": [
    {
      "weight": 1,
      "value": {
        "event": "minecraft:become_stunned",
        "target": "self"
      }
    },
    {
      "weight": 1
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Ravager Blocked (minecraft:ravager_blocked)
 * Defines the ravager's response to their melee attack being
 * blocked.
 */
export default interface MinecraftRavagerBlocked {

  /**
   * @remarks
   * The strength with which blocking entities should be knocked 
   * back
   * 
   * Sample Values:
   * Ravager: 3
   *
   */
  knockback_strength: number;

  /**
   * @remarks
   * A list of weighted responses to the melee attack being 
   * blocked
   * 
   * Sample Values:
   * Ravager: [{"weight":1,"value":{"event":"minecraft:become_stunned","target":"self"}},{"weight":1}]
   *
   */
  reaction_choices: string[];

}