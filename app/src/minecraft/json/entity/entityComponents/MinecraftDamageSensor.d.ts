// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:damage_sensor
 * 
 * minecraft:damage_sensor Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:damage_sensor": {
  "triggers": [
    {
      "on_damage": {
        "filters": {
          "all_of": [
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "is_owner",
              "subject": "other"
            }
          ]
        }
      },
      "deals_damage": "no"
    }
  ]
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

 * At /minecraft:entity/component_groups/minecraft:unrolled/minecraft:damage_sensor/: 
"minecraft:damage_sensor": {
  "triggers": {
    "on_damage": {
      "filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "mob"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          }
        ]
      },
      "event": "minecraft:threat_detected"
    }
  }
}

 * At /minecraft:entity/component_groups/minecraft:rolled_up/minecraft:damage_sensor/: 
"minecraft:damage_sensor": {
  "triggers": [
    {
      "on_damage": {
        "filters": {
          "any_of": [
            {
              "test": "is_family",
              "subject": "other",
              "value": "mob"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            }
          ]
        },
        "event": "minecraft:threat_detected"
      },
      "damage_multiplier": 0.5,
      "damage_modifier": -1
    },
    {
      "damage_multiplier": 0.5,
      "damage_modifier": -1
    }
  ]
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:damage_sensor": {
  "triggers": {
    "cause": "lightning",
    "deals_damage": "yes",
    "damage_multiplier": 2000
  }
}


Bat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bat.json

"minecraft:damage_sensor": {
  "triggers": {
    "cause": "fall",
    "deals_damage": false
  }
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:damage_sensor": {
  "triggers": [
    {
      "cause": "fall",
      "deals_damage": "no"
    },
    {
      "on_damage": {
        "filters": {
          "test": "is_block",
          "subject": "block",
          "value": "minecraft:sweet_berry_bush"
        }
      },
      "deals_damage": "no"
    }
  ]
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:damage_sensor": {
  "triggers": {
    "cause": "fall",
    "deals_damage": "no"
  }
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:damage_sensor": {
  "triggers": [
    {
      "cause": "fall",
      "deals_damage": false
    },
    {
      "on_damage": {
        "filters": {
          "test": "is_family",
          "subject": "damager",
          "operator": "!=",
          "value": "wind_charge"
        }
      },
      "cause": "projectile",
      "deals_damage": false
    }
  ]
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

"minecraft:damage_sensor": {
  "triggers": [
    {
      "cause": "void",
      "deals_damage": "yes"
    },
    {
      "on_damage": {
        "filters": {
          "test": "is_family",
          "subject": "other",
          "value": "player"
        },
        "event": "minecraft:damaged_by_player"
      },
      "cause": "all",
      "deals_damage": "no_but_side_effects_apply"
    },
    {
      "on_damage": {
        "filters": {
          "test": "is_family",
          "subject": "other",
          "value": "mob"
        },
        "event": "minecraft:damaged_by_entity"
      },
      "cause": "all",
      "deals_damage": "no_but_side_effects_apply"
    },
    {
      "on_damage": {
        "event": "minecraft:damaged_by_entity"
      },
      "cause": "projectile",
      "deals_damage": "no_but_side_effects_apply"
    },
    {
      "cause": "all",
      "deals_damage": "no_but_side_effects_apply"
    }
  ]
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:damage_sensor": {
  "triggers": {
    "on_damage": {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "lightning"
      },
      "event": "minecraft:become_charged"
    },
    "deals_damage": false
  }
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:damage_sensor": {
  "triggers": [
    {
      "on_damage": {
        "filters": {
          "test": "is_block",
          "subject": "block",
          "value": "minecraft:sweet_berry_bush"
        }
      },
      "deals_damage": "no"
    }
  ]
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:damage_sensor": {
  "triggers": {
    "cause": "fall",
    "deals_damage": "yes",
    "damage_modifier": -5
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Damage Sensor (minecraft:damage_sensor)
 * Defines what events to call when this entity is damaged by
 * specific entities or items.
 */
export default interface MinecraftDamageSensor {

  /**
   * @remarks
   * Defines how received damage affects the entity.
   */
  deals_damage: boolean;

  /**
   * @remarks
   * List of triggers with the events to call when taking specific kinds
   * of damage."
   * 
   * Sample Values:
   * Allay: [{"on_damage":{"filters":{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"is_owner","subject":"other"}]}},"deals_damage":"no"}]
   *
   * Armadillo: {"on_damage":{"filters":{"any_of":[{"test":"is_family","subject":"other","value":"mob"},{"test":"is_family","subject":"other","value":"player"}]},"event":"minecraft:threat_detected"}}, [{"on_damage":{"filters":{"any_of":[{"test":"is_family","subject":"other","value":"mob"},{"test":"is_family","subject":"other","value":"player"}]},"event":"minecraft:threat_detected"},"damage_multiplier":0.5,"damage_modifier":-1},{"damage_multiplier":0.5,"damage_modifier":-1}]
   *
   */
  triggers: jsoncommon.MinecraftEventTrigger[];

}


export enum MinecraftDamageSensorDealsDamage {
  /**
   * @remarks
   * Received damage is applied to the entity.
   */
  Yes = `yes`,
  /**
   * @remarks
   * Received damage is not applied to the entity.
   */
  No = `no`,
  /**
   * @remarks
   * Received damage is not applied to the entity, but the side
   * effects of the attack are. This means that the attacker's weapon
   * loses durability, enchantment side effects are applied, and so
   * on.
   */
  NoButSideEffectsApply = `no_but_side_effects_apply`
}


/**
 * List of triggers with the events to call when taking specific kinds
 * of damage.".
 */
export interface MinecraftDamageSensorTriggers {

  /**
   * @remarks
   * Type of damage that triggers the events.
   */
  cause: string;

  /**
   * @remarks
   * A modifier that adds/removes to the base damage received from the
   * specified damage cause. It does not reduce damage to less than 
   * 0.
   */
  damage_modifier: number;

  /**
   * @remarks
   * A multiplier that modifies the base damage received from the
   * specified damage cause. If "deals_damage" is true the multiplier can
   * only reduce the damage the entity will take to a minimum of 
   * 1.
   */
  damage_multiplier: number;

  /**
   * @remarks
   * Defines how received damage affects the entity:
            
   *                              \n- "yes", received damage is
   * applied to the entity.
                                     
   *     \n- "no", received damage is not applied to the entity.
 
   *                                         \n-
   * "no_but_side_effects_apply", received damage is not applied to
   * the entity, but the side effects of the attack are. This means
   * that the attacker's weapon loses durability, enchantment side
   * effects are applied, and so on.
   */
  deals_damage: boolean;

  /**
   * @remarks
   * Defines which entities the trigger applies to, and which, if
   * any, event to emit when damaged.
   */
  on_damage: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Defines what sound to play, if any, when the "on_damage" filters are
   * met.
   */
  on_damage_sound_event: string;

}