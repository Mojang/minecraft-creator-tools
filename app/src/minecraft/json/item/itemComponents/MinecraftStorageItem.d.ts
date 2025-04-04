// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:storage_item
 * 
 * minecraft:storage_item Samples

Black Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/black_bundle.json

"minecraft:storage_item": {
  "max_slots": 64,
  "max_weight_limit": 64,
  "weight_in_storage_item": 4,
  "allow_nested_storage_items": true,
  "banned_items": [
    "minecraft:shulker_box",
    "minecraft:undyed_shulker_box"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Storage Item (minecraft:storage_item)
 * Enables an item to store data of the dynamic container associated with
 * it. A dynamic container is a container for storing items that is
 * linked to an item instead of a block or an entity.
 * Note: While this component can be defined on its own, to be
 * able to interact with the item's storage container the item must
 * have a `minecraft:bundle_interaction` item component 
 * defined.
 */
export default interface MinecraftStorageItem {

  /**
   * @remarks
   * Determines whether another Storage Item is allowed inside of
   * this item. Default is true.
   * 
   * Sample Values:
   * Black Bundle: true
   *
   *
   */
  allow_nested_storage_items: boolean;

  /**
   * @remarks
   * List of items that are exclusively allowed in this Storage Item.
   * If empty all items are allowed.
   */
  allowed_items: string;

  /**
   * @remarks
   * List of items that are not allowed in this Storage Item.
   * 
   * Sample Values:
   * Black Bundle: ["minecraft:shulker_box","minecraft:undyed_shulker_box"]
   *
   *
   */
  banned_items: string;

  /**
   * @remarks
   * The maximum allowed weight of the sum of all contained items.
   * Maximum is 64. Default is 64.
   * 
   * Sample Values:
   * Black Bundle: 64
   *
   *
   */
  max_slots: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Black Bundle: 64
   *
   *
   */
  max_weight_limit: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Black Bundle: 4
   *
   *
   */
  weight_in_storage_item: number;

}