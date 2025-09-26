// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:interact
 * 
 * minecraft:interact Samples

Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/1_hello_world/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:interact": {
  "interactions": [
    {
      "cooldown": 2.5,
      "use_item": false,
      "hurt_item": 1,
      "spawn_items": {
        "table": "loot_tables/entities/sheepomelon_shear.json"
      },
      "play_sounds": "shear",
      "interact_text": "action.interact.shear",
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "shears"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_component",
              "operator": "!=",
              "value": "minecraft:is_baby"
            }
          ]
        },
        "event": "minecraft:on_sheared",
        "target": "self"
      }
    }
  ]
}


Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

"minecraft:interact": {
  "interactions": [
    {
      "play_sounds": "armor.equip_generic",
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_equipment",
              "domain": "hand",
              "subject": "other",
              "value": "chest"
            }
          ]
        },
        "event": "minecraft:on_chest",
        "target": "self"
      },
      "use_item": true,
      "interact_text": "action.interact.attachchest"
    }
  ]
}


Cow - https://github.com/microsoft/minecraft-samples/tree/main/behavior_pack_sample/entities/cow.json

"minecraft:interact": {
  "interactions": [
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_equipment",
              "domain": "hand",
              "subject": "other",
              "value": "bucket:0"
            }
          ]
        }
      },
      "use_item": true,
      "transform_to_item": "bucket:1",
      "play_sounds": "milk",
      "interact_text": "action.interact.milk"
    }
  ]
}


Gray Wave - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/gray_wave.json

"minecraft:interact": {
  "interactions": [
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "any_of": [
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:0"
                },
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:16"
                }
              ]
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_black"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:8"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_gray"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:7"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_silver"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "any_of": [
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:15"
                },
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:19"
                }
              ]
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_white"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:12"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_light_blue"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:14"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_orange"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:1"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_red"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "any_of": [
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:4"
                },
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:18"
                }
              ]
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_blue"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:5"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_purple"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:13"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_magenta"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:9"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_pink"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "any_of": [
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:3"
                },
                {
                  "test": "has_equipment",
                  "subject": "other",
                  "domain": "hand",
                  "value": "dye:17"
                }
              ]
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_brown"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:11"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_yellow"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:10"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_lime"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:2"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_green"
      },
      "use_item": true
    },
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "dye:6"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "has_ability",
              "subject": "other",
              "value": "instabuild"
            }
          ]
        },
        "event": "minecraft:turn_cyan"
      },
      "use_item": true
    }
  ]
}


Campghost - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/entities/campghost.json

"minecraft:interact": {
  "interactions": {
    "on_interact": {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "has_equipment",
            "domain": "hand",
            "subject": "other",
            "value": "flint_and_steel"
          },
          {
            "test": "has_component",
            "operator": "!=",
            "value": "minecraft:explode"
          }
        ]
      },
      "event": "minecraft:start_exploding_forced",
      "target": "self"
    },
    "hurt_item": 1,
    "swing": true,
    "play_sounds": "ignite",
    "interact_text": "action.interact.campghost"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Interact (minecraft:interact)
 * Defines interactions with this entity.
 */
export default interface MinecraftInteract {

  /**
   * @remarks
   * Time in seconds before this entity can be interacted with 
   * again.
   */
  cooldown?: number;

  /**
   * @remarks
   * Time in seconds before this entity can be interacted with after
   * being attacked.
   */
  cooldown_after_being_attacked?: number;

  /**
   * @remarks
   * The entity's slot to remove and drop the item from, if any, upon
   * successful interaction. Inventory slots are denoted by positive
   * numbers. Equipment slots are denoted by 'slot.weapon.mainhand',
   * 'slot.weapon.offhand', 'slot.armor.head', 'slot.armor.chest', 'slot.armor.legs',
   * 'slot.armor.feet' and 'slot.armor.body'.
   */
  drop_item_slot?: string;

  /**
   * @remarks
   * Will offset the item drop position this amount in the y
   * direction. Requires "drop_item_slot" to be specified.
   */
  drop_item_y_offset?: number;

  /**
   * @remarks
   * The entity's slot to equip the item to, if any, upon successful
   * interaction. Inventory slots are denoted by positive numbers.
   * Equipment slots are denoted by 'slot.weapon.mainhand', 'slot.weapon.offhand',
   * 'slot.armor.head', 'slot.armor.chest', 'slot.armor.legs', 'slot.armor.feet'
   * and 'slot.armor.body'.
   */
  equip_item_slot?: string;

  /**
   * @remarks
   * The amount of health this entity will recover or lose when
   * interacting with this item. Negative values will harm the
   * entity.
   */
  health_amount?: number;

  /**
   * @remarks
   * The amount of damage the item will take when used to interact with
   * this entity. A value of 0 means the item won't lose 
   * durability.
   */
  hurt_item?: number;

  /**
   * @remarks
   * Text to show when the player is able to interact in this way
   * with this entity when playing with touch-screen controls.
   */
  interact_text?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Sheepomelon: [{"cooldown":2.5,"use_item":false,"hurt_item":1,"spawn_items":{"table":"loot_tables/entities/sheepomelon_shear.json"},"play_sounds":"shear","interact_text":"action.interact.shear","on_interact":{"filters":{"all_of":[{"test":"has_equipment","subject":"other","domain":"hand","value":"shears"},{"test":"is_family","subject":"other","value":"player"},{"test":"has_component","operator":"!=","value":"minecraft:is_baby"}]},"event":"minecraft:on_sheared","target":"self"}}]
   *
   */
  interactions?: MinecraftInteractInteractions[];

}


/**
 * Interactions (interactions)
 */
export interface MinecraftInteractInteractions {

  /**
   * @remarks
   * 
   * Sample Values:
   * Sheepomelon: 2.5
   *
   */
  cooldown?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: true
   *
   */
  give_item?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Sheepomelon: 1
   *
   */
  hurt_item?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Sheepomelon: "action.interact.shear"
   *
   */
  interact_text?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Sheepomelon: {"filters":{"all_of":[{"test":"has_equipment","subject":"other","domain":"hand","value":"shears"},{"test":"is_family","subject":"other","value":"player"},{"test":"has_component","operator":"!=","value":"minecraft:is_baby"}]},"event":"minecraft:on_sheared","target":"self"}
   *
   */
  on_interact?: string;

  /**
   * @remarks
   * Particle effect that will be triggered at the start of the
   * interaction.
   */
  particle_on_start?: MinecraftInteractInteractionsParticleOnStart[];

  /**
   * @remarks
   * List of sounds to play when the interaction occurs.
   */
  play_sounds?: string;

  /**
   * @remarks
   * Allows to repair one of the entity's items.
   */
  repair_entity_item?: MinecraftInteractInteractionsRepairEntityItem[];

  /**
   * @remarks
   * List of entities to spawn when the interaction occurs.
   */
  spawn_entities?: string;

  /**
   * @remarks
   * Loot table with items to drop on the ground upon successful
   * interaction.
   */
  spawn_items?: MinecraftInteractInteractionsSpawnItems[];

  /**
   * @remarks
   * If true, the player will do the 'swing' animation when
   * interacting with this entity.
   */
  swing?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: true
   *
   */
  take_item?: string;

  /**
   * @remarks
   * The item used will transform to this item upon successful interaction.
   * Format: itemName:auxValue
   */
  transform_to_item?: string;

  /**
   * @remarks
   * If true, the interaction will use an item.
   */
  use_item?: boolean;

  /**
   * @remarks
   * Vibration to emit when the interaction occurs. Admitted values are
   * none (no vibration emitted), shear, entity_die, entity_act,
   * entity_interact.
   */
  vibration?: string;

}


/**
 * Particle effect that will be triggered at the start of the
 * interaction.
 */
export interface MinecraftInteractInteractionsParticleOnStart {

  /**
   * @remarks
   * Whether or not the particle will appear closer to who performed the
   * interaction.
   */
  particle_offset_towards_interactor?: boolean;

  /**
   * @remarks
   * The type of particle that will be spawned.
   */
  particle_type?: string;

  /**
   * @remarks
   * Will offset the particle this amount in the y direction.
   */
  particle_y_offset?: number;

}


/**
 * Allows to repair one of the entity's items.
 */
export interface MinecraftInteractInteractionsRepairEntityItem {

  /**
   * @remarks
   * How much of the item durability should be restored upon
   * interaction.
   */
  amount?: number;

  /**
   * @remarks
   * The entity's slot containing the item to be repaired. Inventory slots
   * are denoted by positive numbers. Armor slots are denoted by
   * 'slot.armor.head', 'slot.armor.chest', 'slot.armor.legs', 'slot.armor.feet'
   * and 'slot.armor.body'.
   */
  slot?: number;

}


/**
 * Loot table with items to drop on the ground upon successful
 * interaction.
 */
export interface MinecraftInteractInteractionsSpawnItems {

  /**
   * @remarks
   * File path, relative to the Behavior Pack's path, to the loot
   * table file.
   */
  table?: string;

  /**
   * @remarks
   * Will offset the items spawn position this amount in the y
   * direction.
   */
  y_offset?: number;

}