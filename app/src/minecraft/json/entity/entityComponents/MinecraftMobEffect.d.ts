// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:mob_effect
 * 
 * minecraft:mob_effect Samples

Pufferfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pufferfish.json

"minecraft:mob_effect": {
  "effect_range": 0.2,
  "mob_effect": "poison",
  "effect_time": 10,
  "entity_filter": {
    "any_of": [
      {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "mob"
          },
          {
            "any_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "axolotl"
              },
              {
                "all_of": [
                  {
                    "test": "is_family",
                    "subject": "other",
                    "operator": "not",
                    "value": "aquatic"
                  },
                  {
                    "test": "is_family",
                    "subject": "other",
                    "operator": "not",
                    "value": "undead"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "has_ability",
            "subject": "other",
            "operator": "not",
            "value": "instabuild"
          }
        ]
      }
    ]
  }
}


Warden - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/warden.json

"minecraft:mob_effect": {
  "effect_range": 20,
  "effect_time": 13,
  "mob_effect": "darkness",
  "cooldown_time": 6,
  "entity_filter": {
    "all_of": [
      {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      {
        "operator": "not",
        "test": "has_ability",
        "subject": "other",
        "value": "invulnerable"
      }
    ]
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Mob Effect (minecraft:mob_effect)
 * A component that applies a mob effect to entities that get
 * within range.
 */
export default interface MinecraftMobEffect {

  /**
   * @remarks
   * Time in seconds to wait between each application of the 
   * effect.
   * 
   * Sample Values:
   * Warden: 6
   *
   */
  cooldown_time: number;

  /**
   * @remarks
   * How close a hostile entity must be to have the mob effect 
   * applied.
   * 
   * Sample Values:
   * Pufferfish: 0.2
   *
   * Warden: 20
   *
   */
  effect_range: number;

  /**
   * @remarks
   * How long the applied mob effect lasts in seconds. Can also be
   * set to "infinite"
   * 
   * Sample Values:
   * Pufferfish: 10
   *
   * Warden: 13
   *
   */
  effect_time: number;

  /**
   * @remarks
   * The set of entities that are valid to apply the mob effect 
   * to.
   * 
   * Sample Values:
   * Pufferfish: {"any_of":[{"all_of":[{"test":"is_family","subject":"other","value":"mob"},{"any_of":[{"test":"is_family","subject":"other","value":"axolotl"},{"all_of":[{"test":"is_family","subject":"other","operator":"not","value":"aquatic"},{"test":"is_family","subject":"other","operator":"not","value":"undead"}]}]}]},{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"has_ability","subject":"other","operator":"not","value":"instabuild"}]}]}
   *
   * Warden: {"all_of":[{"test":"is_family","subject":"other","value":"player"},{"operator":"not","test":"has_ability","subject":"other","value":"invulnerable"}]}
   *
   */
  entity_filter: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The mob effect that is applied to entities that enter this
   * entities effect range.
   * 
   * Sample Values:
   * Pufferfish: "poison"
   *
   * Warden: "darkness"
   *
   */
  mob_effect: string;

}