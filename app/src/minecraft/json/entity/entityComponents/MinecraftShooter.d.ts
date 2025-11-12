// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:shooter
 * 
 * minecraft:shooter Samples

Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:shooter": {
  "def": "minecraft:small_fireball"
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:shooter": {
  "def": "minecraft:arrow",
  "sound": "bow",
  "aux_val": 26
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:shooter": {
  "def": "minecraft:thrown_trident",
  "sound": "item.trident.throw"
}


Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:shooter": {
  "def": "minecraft:dragon_fireball"
}


Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ghast.json

"minecraft:shooter": {
  "def": "minecraft:fireball"
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:shooter": {
  "def": "minecraft:llama_spit"
}


Parched - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parched.json

"minecraft:shooter": {
  "def": "minecraft:arrow",
  "sound": "bow",
  "aux_val": 35
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:shooter": {
  "def": "minecraft:arrow"
}


Shulker - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/shulker.json

"minecraft:shooter": {
  "def": "minecraft:shulker_bullet"
}


Snow Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snow_golem.json

"minecraft:shooter": {
  "def": "minecraft:snowball"
}


Witch - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/witch.json

"minecraft:shooter": {
  "power": 0.75,
  "def": "minecraft:splash_potion",
  "aux_val": 23,
  "sound": "throw",
  "projectiles": [
    {
      "def": "minecraft:splash_potion",
      "aux_val": 21,
      "filters": {
        "all_of": [
          {
            "test": "is_raider",
            "subject": "other",
            "value": true
          },
          {
            "test": "actor_health",
            "subject": "other",
            "value": 4,
            "operator": "<="
          }
        ]
      },
      "lose_target": true
    },
    {
      "def": "minecraft:splash_potion",
      "aux_val": 28,
      "filters": {
        "all_of": [
          {
            "test": "is_raider",
            "subject": "other",
            "value": true
          }
        ]
      },
      "lose_target": true
    },
    {
      "def": "minecraft:splash_potion",
      "aux_val": 17,
      "filters": {
        "all_of": [
          {
            "test": "target_distance",
            "subject": "self",
            "value": 8,
            "operator": ">="
          },
          {
            "none_of": [
              {
                "test": "has_mob_effect",
                "subject": "other",
                "value": "slowness"
              }
            ]
          }
        ]
      }
    },
    {
      "def": "minecraft:splash_potion",
      "aux_val": 25,
      "filters": {
        "all_of": [
          {
            "test": "actor_health",
            "subject": "other",
            "value": 8,
            "operator": ">="
          },
          {
            "none_of": [
              {
                "test": "has_mob_effect",
                "subject": "other",
                "value": "poison"
              }
            ]
          }
        ]
      }
    },
    {
      "def": "minecraft:splash_potion",
      "aux_val": 34,
      "filters": {
        "all_of": [
          {
            "test": "target_distance",
            "subject": "self",
            "value": 3,
            "operator": "<="
          },
          {
            "none_of": [
              {
                "test": "has_mob_effect",
                "subject": "other",
                "value": "weakness"
              }
            ]
          }
        ]
      },
      "chance": 0.25
    }
  ],
  "magic": true
}


Axe Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/axe_turret.behavior.json

"minecraft:shooter": {
  "def": "minecraft:shulker_bullet",
  "power": 10
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Shooter (minecraft:shooter)
 * Defines the entity's ranged attack behavior. The
 * "minecraft:behavior.ranged_attack" goal uses this component to
 * determine which projectiles to shoot.
 * Note: Ammunition used by minecraft:shooter must have the
 * minecraft:projectile component in order to function 
 * properly.
 */
export default interface MinecraftShooter {

  /**
   * @remarks
   * ID of the Potion effect for the default projectile to be
   * applied on hit.
   * 
   * Sample Values:
   * Bogged: 26
   *
   * Parched: 35
   *
   * Witch: 23
   *
   */
  aux_val?: number;

  /**
   * @remarks
   * Actor definition to use as the default projectile for the ranged
   * attack. The actor definition must have the projectile component to
   * be able to be shot as a projectile.
   * 
   * Sample Values:
   * Blaze: "minecraft:small_fireball"
   *
   * Bogged: "minecraft:arrow"
   *
   * Drowned: "minecraft:thrown_trident"
   *
   */
  def?: string;

  /**
   * @remarks
   * Sets whether the projectiles being used are flagged as magic. If
   * set, the ranged attack goal will not be used at the same time as
   * other magic goals, such as minecraft:behavior.drink_potion
   * 
   * Sample Values:
   * Witch: true
   *
   */
  magic?: boolean;

  /**
   * @remarks
   * Velocity in which the projectiles will be shot at. A power of 0
   * will be overwritten by the default projectile throw power.
   * 
   * Sample Values:
   * Witch: 0.75
   *
   * Axe Turret: 10
   *
   * Bow Turret: 7
   *
   */
  power?: number;

  /**
   * @remarks
   * List of projectiles that can be used by the shooter. Projectiles are
   * evaluated in the order of the list; After a projectile is
   * chosen, the rest of the list is ignored.
   * 
   * Sample Values:
   * Witch: [{"def":"minecraft:splash_potion","aux_val":21,"filters":{"all_of":[{"test":"is_raider","subject":"other","value":true},{"test":"actor_health","subject":"other","value":4,"operator":"<="}]},"lose_target":true},{"def":"minecraft:splash_potion","aux_val":28,"filters":{"all_of":[{"test":"is_raider","subject":"other","value":true}]},"lose_target":true},{"def":"minecraft:splash_potion","aux_val":17,"filters":{"all_of":[{"test":"target_distance","subject":"self","value":8,"operator":">="},{"none_of":[{"test":"has_mob_effect","subject":"other","value":"slowness"}]}]}},{"def":"minecraft:splash_potion","aux_val":25,"filters":{"all_of":[{"test":"actor_health","subject":"other","value":8,"operator":">="},{"none_of":[{"test":"has_mob_effect","subject":"other","value":"poison"}]}]}},{"def":"minecraft:splash_potion","aux_val":34,"filters":{"all_of":[{"test":"target_distance","subject":"self","value":3,"operator":"<="},{"none_of":[{"test":"has_mob_effect","subject":"other","value":"weakness"}]}]},"chance":0.25}]
   *
   */
  projectiles?: string[];

  /**
   * @remarks
   * Sound that is played when the shooter shoots a projectile.
   * 
   * Sample Values:
   * Bogged: "bow"
   *
   * Drowned: "item.trident.throw"
   *
   *
   * Witch: "throw"
   *
   */
  sound?: string;

}