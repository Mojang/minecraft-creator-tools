// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:repairable
 * 
 * minecraft:repairable Samples

Copper Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/copper_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:copper_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        "minecraft:copper_ingot"
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Diamond Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/diamond_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:diamond_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        "minecraft:diamond"
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Golden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/golden_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:golden_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        "minecraft:gold_ingot"
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Iron Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/iron_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:iron_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        "minecraft:iron_ingot"
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Netherite Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/netherite_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:netherite_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        "minecraft:netherite_ingot"
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Stone Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/stone_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:stone_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        {
          "tags": "q.all_tags('minecraft:stone_tool_materials')"
        }
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Wooden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wooden_spear.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:wooden_spear"
      ],
      "repair_amount": "context.other->query.remaining_durability"
    },
    {
      "items": [
        {
          "tags": "q.all_tags('minecraft:planks')"
        }
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}


Item Axe Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/axe_turret_kit.item.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "iron_ingot"
      ],
      "repair_amount": 62
    }
  ]
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:stick"
      ],
      "repair_amount": "context.other->query.remaining_durability + 0.05 * context.other->query.max_durability"
    }
  ]
}


My Sword Chuck - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_chuck.json

"minecraft:repairable": {
  "repair_items": [
    {
      "items": [
        "minecraft:diamond"
      ],
      "repair_amount": "query.max_durability * 0.25"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Repairable (minecraft:repairable)
 * The repairable item component specifies which items can be used
 * to repair this item, along with how much durability is 
 * gained.
 */
export default interface MinecraftRepairable {

  /**
   * @remarks
   * List of repair item entries. Each entry needs to define a list of
   * strings for `items` that can be used for the repair and an
   * optional `repair_amount` for how much durability is gained.
   * 
   * Sample Values:
   * Copper Spear: [{"items":["minecraft:copper_spear"],"repair_amount":"context.other->query.remaining_durability"},{"items":["minecraft:copper_ingot"],"repair_amount":"query.max_durability * 0.25"}]
   *
   * Diamond Spear: [{"items":["minecraft:diamond_spear"],"repair_amount":"context.other->query.remaining_durability"},{"items":["minecraft:diamond"],"repair_amount":"query.max_durability * 0.25"}]
   *
   * Golden Spear: [{"items":["minecraft:golden_spear"],"repair_amount":"context.other->query.remaining_durability"},{"items":["minecraft:gold_ingot"],"repair_amount":"query.max_durability * 0.25"}]
   *
   */
  repair_items?: string;

}