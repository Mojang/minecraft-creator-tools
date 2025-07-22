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
"minecraft:repairable": {
  "on_repaired": "minecraft:celebrate",
  "repair_items": [
    "anvil"
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
 * Minecraft Repairable Item (minecraft:repairable)
 * Defines the items that can be used to repair a defined item, and
 * the amount of durability each item restores upon repair. Each
 * entry needs to define a list of strings for 'items' that can be
 * used for the repair and an optional 'repair_amount' for how much
 * durability is repaired.
 */
export default interface MinecraftRepairable {

  /**
   * @remarks
   * List of repair item entries. Each entry needs to define a list of
   * strings for `items` that can be used for the repair and an
   * optional `repair_amount` for how much durability is gained.
   * 
   * Sample Values:
   * Chestplate: [{"items":["minecraft:stick"],"repair_amount":"context.other->query.remaining_durability + 0.05 * context.other->query.max_durability"}]
   *
   *
   * My Sword Chuck: [{"items":["minecraft:diamond"],"repair_amount":"query.max_durability * 0.25"}]
   *
   *
   */
  repair_items: string;

}