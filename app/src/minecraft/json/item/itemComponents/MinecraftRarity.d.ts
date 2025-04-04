// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:rarity
 * 
 * minecraft:rarity Samples
"minecraft:rarity": {
  "minecraft:rarity": "rare"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Rarity (minecraft:rarity)
 * Specifies the base rarity and subsequently color of the item name
 * when the player hovers the cursor over the item.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface MinecraftRarity {

  /**
   * @remarks
   * Sets the base rarity of the item. The rarity of an item
   * automatically increases when enchanted, either to Rare when the
   * base rarity is Common or Uncommon, or Epic when the base rarity is
   * Rare.
   */
  value: string;

}


export enum MinecraftRarityValue {
  Common = `common`,
  Uncommon = `uncommon`,
  Rare = `rare`,
  Epic = `epic`
}