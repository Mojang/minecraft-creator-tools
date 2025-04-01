// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:area_attack
 * 
 * minecraft:area_attack Samples

Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

 * At /minecraft:entity/component_groups/minecraft:slime_large/minecraft:area_attack/: 
"minecraft:area_attack": {
  "damage_range": 0.15,
  "damage_per_tick": 6,
  "damage_cooldown": 0.5,
  "cause": "entity_attack",
  "entity_filter": {
    "any_of": [
      {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      }
    ]
  }
}

 * At /minecraft:entity/component_groups/minecraft:slime_medium/minecraft:area_attack/: 
"minecraft:area_attack": {
  "damage_range": 0.15,
  "damage_per_tick": 4,
  "damage_cooldown": 0.5,
  "cause": "entity_attack",
  "entity_filter": {
    "any_of": [
      {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      }
    ]
  }
}

 * At /minecraft:entity/component_groups/minecraft:slime_small/minecraft:area_attack/: 
"minecraft:area_attack": {
  "damage_range": 0.15,
  "damage_per_tick": 3,
  "damage_cooldown": 0.5,
  "cause": "entity_attack",
  "entity_filter": {
    "any_of": [
      {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      }
    ]
  }
}


Pufferfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pufferfish.json

"minecraft:area_attack": {
  "damage_range": 0.2,
  "damage_per_tick": 2,
  "damage_cooldown": 0.5,
  "cause": "contact",
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
                "test": "is_family",
                "subject": "other",
                "operator": "not",
                "value": "aquatic"
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


Slime - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/slime.json

 * At /minecraft:entity/component_groups/minecraft:slime_large/minecraft:area_attack/: 
"minecraft:area_attack": {
  "damage_range": 0.15,
  "damage_per_tick": 4,
  "damage_cooldown": 0.5,
  "cause": "entity_attack",
  "entity_filter": {
    "any_of": [
      {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "snowgolem"
      }
    ]
  }
}

 * At /minecraft:entity/component_groups/minecraft:slime_medium/minecraft:area_attack/: 
"minecraft:area_attack": {
  "damage_range": 0.15,
  "damage_per_tick": 2,
  "damage_cooldown": 0.5,
  "cause": "entity_attack",
  "entity_filter": {
    "any_of": [
      {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      },
      {
        "test": "is_family",
        "subject": "other",
        "value": "snowgolem"
      }
    ]
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Area Attack (minecraft:area_attack)
 * A component that does damage to entities that get within 
 * range.
 */
export default interface MinecraftAreaAttack {

  /**
   * @remarks
   * The type of damage that is applied to entities that enter the
   * damage range. A list of available damage sources can be found at
   * [Entity Damage Sources located in the Vanilla Listings
   * 
   * Documentation](../../VanillaListingsReference/AddonEntityDamageSources.md).
   * 
   * Sample Values:
   * Magma Cube: "entity_attack"
   *
   * Pufferfish: "contact"
   *
   */
  cause: string;

  /**
   * @remarks
   * Attack cooldown (in seconds) for how often this entity can
   * attack a target.
   * 
   * Sample Values:
   * Magma Cube: 0.5
   *
   */
  damage_cooldown: number;

  /**
   * @remarks
   * How much damage per tick is applied to entities that enter the
   * damage range.
   * 
   * Sample Values:
   * Magma Cube: 6, 4, 3
   *
   */
  damage_per_tick: number;

  /**
   * @remarks
   * How close a hostile entity must be to have the damage 
   * applied.
   * 
   * Sample Values:
   * Magma Cube: 0.15
   *
   * Pufferfish: 0.2
   *
   */
  damage_range: string;

  /**
   * @remarks
   * The set of entities that are valid to apply the damage to when
   * within range.
   * 
   * Sample Values:
   * Magma Cube: {"any_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"is_family","subject":"other","value":"irongolem"}]}
   *
   * Pufferfish: {"any_of":[{"all_of":[{"test":"is_family","subject":"other","value":"mob"},{"any_of":[{"test":"is_family","subject":"other","value":"axolotl"},{"test":"is_family","subject":"other","operator":"not","value":"aquatic"}]}]},{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"has_ability","subject":"other","operator":"not","value":"instabuild"}]}]}
   *
   * Slime: {"any_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"is_family","subject":"other","value":"irongolem"},{"test":"is_family","subject":"other","value":"snowgolem"}]}
   *
   */
  entity_filter: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * If the entity should play their attack sound when attacking a
   * target.
   */
  play_attack_sound: boolean;

}