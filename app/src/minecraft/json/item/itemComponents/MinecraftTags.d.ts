// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:tags
 * 
 * minecraft:tags Samples

Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:tags": {
  "tags": [
    "minecraft:is_food"
  ]
}


Copper Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/copper_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:copper_tier",
    "minecraft:is_spear"
  ]
}


Diamond Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/diamond_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:diamond_tier",
    "minecraft:transformable_items",
    "minecraft:is_spear"
  ]
}


Golden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/golden_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:golden_tier",
    "minecraft:is_spear"
  ]
}


Iron Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/iron_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:iron_tier",
    "minecraft:is_spear"
  ]
}


Netherite Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/netherite_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:netherite_tier",
    "minecraft:is_spear"
  ]
}


Stone Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/stone_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:stone_tier",
    "minecraft:is_spear"
  ]
}


Wooden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wooden_spear.json

"minecraft:tags": {
  "tags": [
    "minecraft:wooden_tier",
    "minecraft:is_spear"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Tags (minecraft:tags)
 * The tags component specifies which tags an item has on it.
 */
export default interface MinecraftTags {

  /**
   * @remarks
   * An array that can contain multiple item tags.
   * 
   * Sample Values:
   * Apple: ["minecraft:is_food"]
   *
   * Copper Spear: ["minecraft:copper_tier","minecraft:is_spear"]
   *
   * Diamond Spear: ["minecraft:diamond_tier","minecraft:transformable_items","minecraft:is_spear"]
   *
   */
  tags?: string[];

}