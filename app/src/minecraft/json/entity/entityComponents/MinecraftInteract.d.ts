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

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

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
              "test": "is_sneak_held",
              "subject": "other",
              "value": false
            }
          ]
        }
      },
      "give_item": true,
      "take_item": true,
      "interact_text": "action.interact.allay"
    }
  ]
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

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
              "subject": "other",
              "domain": "hand",
              "value": "brush"
            }
          ]
        }
      },
      "play_sounds": "mob.armadillo.brush",
      "interact_text": "action.interact.brush",
      "hurt_item": 16,
      "swing": true,
      "spawn_items": {
        "table": "loot_tables/entities/armadillo_brush.json"
      }
    }
  ]
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

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
              "value": "minecraft:open_eyeblossom"
            }
          ]
        },
        "event": "fed_open_eyeblossom"
      },
      "use_item": true,
      "particle_on_start": {
        "particle_type": "food"
      },
      "interact_text": "action.interact.feed"
    },
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
              "value": "minecraft:wither_rose"
            }
          ]
        },
        "event": "fed_wither_rose"
      },
      "use_item": true,
      "particle_on_start": {
        "particle_type": "food"
      },
      "interact_text": "action.interact.feed"
    }
  ]
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:interact": {
  "interactions": [
    {
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
              "test": "has_component",
              "operator": "!=",
              "value": "minecraft:is_sheared"
            }
          ]
        },
        "event": "be_sheared",
        "target": "self"
      },
      "use_item": false,
      "hurt_item": 1,
      "play_sounds": "shear",
      "spawn_items": {
        "table": "loot_tables/entities/bogged_shear.json"
      },
      "interact_text": "action.interact.shear"
    }
  ]
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:interact": {
  "interactions": [
    {
      "play_sounds": "saddle",
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "self",
              "domain": "inventory",
              "operator": "not",
              "value": "saddle"
            },
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "saddle"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "is_sneak_held",
              "subject": "other",
              "value": false
            }
          ]
        },
        "target": "self"
      },
      "equip_item_slot": "0",
      "interact_text": "action.interact.saddle"
    }
  ]
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

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


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

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
    "interact_text": "action.interact.creeper"
  }
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

 * At /minecraft:entity/component_groups/minecraft:donkey_tamed/minecraft:interact/: 
"minecraft:interact": {
  "interactions": [
    {
      "play_sounds": "armor.equip_generic",
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "self",
              "domain": "inventory",
              "operator": "not",
              "value": "saddle"
            },
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "saddle"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "is_sneak_held",
              "subject": "other",
              "value": false
            }
          ]
        },
        "target": "self"
      },
      "equip_item_slot": "0",
      "interact_text": "action.interact.equip"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:donkey_unchested/minecraft:interact/: 
"minecraft:interact": {
  "interactions": [
    {
      "play_sounds": "armor.equip_generic",
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "self",
              "domain": "inventory",
              "operator": "not",
              "value": "saddle"
            },
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "saddle"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "is_sneak_held",
              "subject": "other",
              "value": false
            }
          ]
        },
        "target": "self"
      },
      "equip_item_slot": "0",
      "interact_text": "action.interact.saddle"
    },
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
              "test": "is_sneaking",
              "subject": "other",
              "value": false
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

 * At /minecraft:entity/component_groups/minecraft:donkey_chested/minecraft:interact/: 
"minecraft:interact": {
  "interactions": [
    {
      "play_sounds": "armor.equip_generic",
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_equipment",
              "subject": "self",
              "domain": "inventory",
              "operator": "not",
              "value": "saddle"
            },
            {
              "test": "has_equipment",
              "subject": "other",
              "domain": "hand",
              "value": "saddle"
            },
            {
              "test": "is_family",
              "subject": "other",
              "value": "player"
            },
            {
              "test": "is_sneaking",
              "subject": "other",
              "value": false
            }
          ]
        },
        "target": "self"
      },
      "equip_item_slot": "0",
      "interact_text": "action.interact.saddle"
    }
  ]
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

 * At /minecraft:entity/component_groups/interact_default/minecraft:interact/: 
"minecraft:interact": {
  "interactions": [
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_component",
              "subject": "self",
              "operator": "!=",
              "value": "minecraft:is_baby"
            },
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
      "play_sounds": "milk_suspiciously",
      "interact_text": "action.interact.milk"
    }
  ]
}

 * At /minecraft:entity/component_groups/interact_screamer/minecraft:interact/: 
"minecraft:interact": {
  "interactions": [
    {
      "on_interact": {
        "filters": {
          "all_of": [
            {
              "test": "has_component",
              "subject": "self",
              "operator": "!=",
              "value": "minecraft:is_baby"
            },
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
      "play_sounds": "milk.screamer",
      "interact_text": "action.interact.milk"
    }
  ]
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
   * Loot table with items to add to the player's inventory upon
   * successful interaction.
   */
  add_items: MinecraftInteractAddItems[];

  /**
   * @remarks
   * Time in seconds before this entity can be interacted with 
   * again.
   */
  cooldown: number;

  /**
   * @remarks
   * Time in seconds before this entity can be interacted with after
   * being attacked.
   */
  cooldown_after_being_attacked: number;

  /**
   * @remarks
   * The entity's slot to remove and drop the item from, if any, upon
   * successful interaction. Inventory slots are denoted by positive
   * numbers. Armor slots are denoted by 'slot.armor.head', 'slot.armor.chest',
   * 'slot.armor.legs', 'slot.armor.feet' and 'slot.armor.body'.
   */
  drop_item_slot: string;

  /**
   * @remarks
   * The entity's slot to equip the item to, if any, upon successful
   * interaction. Inventory slots are denoted by positive numbers. Armor
   * slots are denoted by 'slot.armor.head', 'slot.armor.chest', 'slot.armor.legs',
   * 'slot.armor.feet' and 'slot.armor.body'.
   */
  equip_item_slot: string;

  /**
   * @remarks
   * The amount of health this entity will recover or lose when
   * interacting with this item. Negative values will harm the
   * entity.
   */
  health_amount: number;

  /**
   * @remarks
   * The amount of damage the item will take when used to interact with
   * this entity. A value of 0 means the item won't lose 
   * durability.
   */
  hurt_item: number;

  /**
   * @remarks
   * Text to show when the player is able to interact in this way
   * with this entity when playing with Touch-screen controls.
   */
  interact_text: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: [{"on_interact":{"filters":{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"is_sneak_held","subject":"other","value":false}]}},"give_item":true,"take_item":true,"interact_text":"action.interact.allay"}]
   *
   * Armadillo: [{"on_interact":{"filters":{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"has_equipment","subject":"other","domain":"hand","value":"brush"}]}},"play_sounds":"mob.armadillo.brush","interact_text":"action.interact.brush","hurt_item":16,"swing":true,"spawn_items":{"table":"loot_tables/entities/armadillo_brush.json"}}]
   *
   */
  interactions: MinecraftInteractInteractions[];

  /**
   * @remarks
   * Event to fire when the interaction occurs.
   */
  on_interact: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Particle effect that will be triggered at the start of the
   * interaction.
   */
  particle_on_start: MinecraftInteractParticleOnStart[];

  /**
   * @remarks
   * List of sounds to play when the interaction occurs.
   */
  play_sounds: string;

  /**
   * @remarks
   * Allows to repair one of the entity's items.
   */
  repair_entity_item: MinecraftInteractRepairEntityItem[];

  /**
   * @remarks
   * List of entities to spawn when the interaction occurs.
   */
  spawn_entities: string;

  /**
   * @remarks
   * Loot table with items to drop on the ground upon successful
   * interaction.
   */
  spawn_items: MinecraftInteractSpawnItems[];

  /**
   * @remarks
   * If true, the player will do the 'swing' animation when
   * interacting with this entity.
   */
  swing: boolean;

  /**
   * @remarks
   * The item used will transform to this item upon successful interaction.
   * Format: itemName:auxValue
   */
  transform_to_item: string;

  /**
   * @remarks
   * If true, the interaction will use an item.
   */
  use_item: boolean;

  /**
   * @remarks
   * Vibration to emit when the interaction occurs. Admitted values are
   * none (no vibration emitted), shear, entity_die, entity_act,
   * entity_interact.
   */
  vibration: string;

}


/**
 * Loot table with items to add to the player's inventory upon
 * successful interaction.
 */
export interface MinecraftInteractAddItems {

  /**
   * @remarks
   * File path, relative to the Behavior Pack's path, to the loot
   * table file.
   */
  table: string;

}


/**
 * Interactions (interactions)
 */
export interface MinecraftInteractInteractions {

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: true
   *
   */
  give_item: string;

  hurt_item: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: "action.interact.allay"
   *
   */
  interact_text: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: {"filters":{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"is_sneak_held","subject":"other","value":false}]}}
   *
   */
  on_interact: string;

  particle_on_start: MinecraftInteractInteractionsParticleOnStart;

  play_sounds: string;

  spawn_items: MinecraftInteractInteractionsSpawnItems;

  swing: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: true
   *
   */
  take_item: string;

  use_item: string;

}


/**
 * Particle_on_start (particle_on_start)
 */
export interface MinecraftInteractInteractionsParticleOnStart {

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: "food"
   *
   */
  particle_type: string;

}


/**
 * Spawn_items (spawn_items)
 */
export interface MinecraftInteractInteractionsSpawnItems {

  /**
   * @remarks
   * 
   * Sample Values:
   * Armadillo: "loot_tables/entities/armadillo_brush.json"
   *
   */
  table: string;

}


/**
 * Particle effect that will be triggered at the start of the
 * interaction.
 */
export interface MinecraftInteractParticleOnStart {

  /**
   * @remarks
   * Whether or not the particle will appear closer to who performed the
   * interaction.
   */
  particle_offset_towards_interactor: boolean;

  /**
   * @remarks
   * The type of particle that will be spawned.
   */
  particle_type: string;

  /**
   * @remarks
   * Will offset the particle this amount in the y direction.
   */
  particle_y_offset: number;

}


/**
 * Allows to repair one of the entity's items.
 */
export interface MinecraftInteractRepairEntityItem {

  /**
   * @remarks
   * How much of the item durability should be restored upon
   * interaction.
   */
  amount: number;

  /**
   * @remarks
   * The entity's slot containing the item to be repaired. Inventory slots
   * are denoted by positive numbers. Armor slots are denoted by
   * 'slot.armor.head', 'slot.armor.chest', 'slot.armor.legs', 'slot.armor.feet'
   * and 'slot.armor.body'.
   */
  slot: number;

}


/**
 * Loot table with items to drop on the ground upon successful
 * interaction.
 */
export interface MinecraftInteractSpawnItems {

  /**
   * @remarks
   * File path, relative to the Behavior Pack's path, to the loot
   * table file.
   */
  table: string;

}