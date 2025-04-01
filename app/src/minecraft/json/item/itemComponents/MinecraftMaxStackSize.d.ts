// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:max_stack_size
 * 
 * minecraft:max_stack_size Samples

Beetroot Soup - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/beetroot_soup.json

"minecraft:max_stack_size": 1

Honey Bottle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/honey_bottle.json

"minecraft:max_stack_size": 16

Item Axe Turret Kit - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/axe_turret_kit.item.json

"minecraft:max_stack_size": {
  "value": 64
}


Item Depleted Gray Shard - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/items/depleted_gray_shard.item.json

"minecraft:max_stack_size": 64
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Max Stack Size (minecraft:max_stack_size)
 * Determines how many of an item can be stacked together.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Integer number`.

 */
export default interface MinecraftMaxStackSize {

  /**
   * @remarks
   * How many of an item that can be stacked together.
   */
  value: number;

}