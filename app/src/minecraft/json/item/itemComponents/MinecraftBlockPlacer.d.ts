// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:block_placer
 * 
 * minecraft:block_placer Samples

My Sword Singing - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_sword_singing.json

"minecraft:block_placer": {
  "block": "minecraft:dirt",
  "use_on": [
    {
      "name": "minecraft:dirt"
    },
    {
      "name": "minecraft:grass_block"
    },
    {
      "name": "minecraft:anvil"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Block Placer (minecraft:block_placer)
 * Items with the block_placer component will place a block when
 * used. 
This component can also be used instead of the
 * "minecraft:icon" component to render the referenced block as
 * the item icon.
 */
export default interface MinecraftBlockPlacer {

  /**
   * @remarks
   * Defines the block that will be placed.
   * 
   * Sample Values:
   * My Sword Singing: "minecraft:dirt"
   *
   */
  block: object;

  /**
   * @remarks
   * If true, the item will be registered as the item for this block.
   * This item will be returned by default when the block is
   * broken/picked. Note: the identifier for this item must match the
   * block's identifier for this field to be valid.
   */
  replace_block_item?: boolean;

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * used on. If left empty, all blocks will be allowed.
   * 
   * Sample Values:
   * My Sword Singing: [{"name":"minecraft:dirt"},{"name":"minecraft:grass_block"},{"name":"minecraft:anvil"}]
   *
   */
  use_on?: MinecraftBlockPlacerUseOn[];

}


/**
 * Use On (use_on)
 */
export interface MinecraftBlockPlacerUseOn {

  name?: string;

  states?: number;

  tags?: string;

}