// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:hurt_on_condition
 * 
 * minecraft:hurt_on_condition Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:hurt_on_condition": {
  "damage_conditions": [
    {
      "filters": {
        "test": "in_lava",
        "subject": "self"
      },
      "cause": "lava",
      "damage_per_tick": 4
    }
  ]
}


Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

"minecraft:hurt_on_condition": {
  "damage_conditions": [
    {
      "filters": {
        "test": "in_lava",
        "subject": "self",
        "operator": "==",
        "value": true
      },
      "cause": "lava",
      "damage_per_tick": 4
    }
  ]
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:hurt_on_condition": {
  "damage_conditions": [
    {
      "filters": {
        "test": "in_contact_with_water"
      },
      "cause": "drowning",
      "damage_per_tick": 1
    }
  ]
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:hurt_on_condition": {
  "damage_conditions": [
    {
      "filters": {
        "test": "in_lava"
      },
      "cause": "lava",
      "damage_per_tick": 4
    }
  ]
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:hurt_on_condition": {
  "damage_conditions": [
    {
      "filters": {
        "test": "in_lava",
        "subject": "self"
      },
      "cause": "lava",
      "damage_per_tick": 4
    },
    {
      "filters": {
        "test": "in_contact_with_water"
      },
      "cause": "drowning",
      "damage_per_tick": 1
    }
  ]
}


Snow Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snow_golem.json

"minecraft:hurt_on_condition": {
  "damage_conditions": [
    {
      "filters": {
        "test": "in_lava",
        "subject": "self",
        "operator": "==",
        "value": true
      },
      "cause": "lava",
      "damage_per_tick": 4
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_temperature_value",
            "operator": ">",
            "value": 1
          },
          {
            "test": "has_component",
            "subject": "self",
            "operator": "!=",
            "value": "minecraft:effect.fire_resistance"
          }
        ]
      },
      "cause": "temperature",
      "damage_per_tick": 1
    },
    {
      "filters": {
        "test": "in_contact_with_water",
        "operator": "==",
        "value": true
      },
      "cause": "drowning",
      "damage_per_tick": 1
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Hurt On Condition (minecraft:hurt_on_condition)
 * Defines a set of conditions under which an entity should take
 * damage.
 */
export default interface MinecraftHurtOnCondition {

  /**
   * @remarks
   * List of damage conditions that when met can cause damage to the
   * entity.
   * 
   * Sample Values:
   * Allay: [{"filters":{"test":"in_lava","subject":"self"},"cause":"lava","damage_per_tick":4}]
   *
   *
   */
  damage_conditions: MinecraftHurtOnConditionDamageConditions[];

}


/**
 * List of damage conditions that when met can cause damage to the
 * entity.
 */
export interface MinecraftHurtOnConditionDamageConditions {

  /**
   * @remarks
   * The kind of damage that is caused to the entity. Various armors and
   * spells use this to determine if the entity is immune.
   */
  cause: string;

  /**
   * @remarks
   * The amount of damage done each tick that the conditions are 
   * met.
   */
  damage_per_tick: number;

  /**
   * @remarks
   * The set of conditions that must be satisfied before the entity
   * takes the defined damage.
   */
  filters: jsoncommon.MinecraftFilter;

}