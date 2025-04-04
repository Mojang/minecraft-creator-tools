// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:display_name
 * 
 * minecraft:display_name Samples
 * At sample: 
"minecraft:display_name": {
  "value": "secret_weapon"
}

 * At sample with localication key: 
"minecraft:display_name": {
  "value": "item.snowball.name"
}


Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:display_name": {
  "value": "item.apple.name"
}


Breeze Rod - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/breeze_rod.json

"minecraft:display_name": {
  "value": "item.breeze_rod.name"
}


Ominous Trial Key - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/ominous_trial_key.json

"minecraft:display_name": {
  "value": "item.ominous_trial_key.name"
}


Trial Key - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/trial_key.json

"minecraft:display_name": {
  "value": "item.trial_key.name"
}


Wind Charge - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wind_charge.json

"minecraft:display_name": {
  "value": "item.wind_charge.name"
}


Chestplate - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/chestplate.json

"minecraft:display_name": {
  "value": "My Custom Armor"
}


Goo - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/goo.json

"minecraft:display_name": {
  "value": "Weird Goo"
}


My Boots - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_boots.json

"minecraft:display_name": {
  "value": "My Custom Boots"
}


My Helm - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_helm.json

"minecraft:display_name": {
  "value": "My Custom Helmet"
}


My Leggings - https://github.com/microsoft/minecraft-samples/tree/main/custom_items/behavior_packs/custom_item/items/my_leggings.json

"minecraft:display_name": {
  "value": "My Custom Leggings"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Display Name (minecraft:display_name)
 * Sets the item display name within Minecraft: Bedrock Edition. This
 * component may also be used to pull from the localization file by
 * referencing a key from it.
 */
export default interface MinecraftDisplayName {

  /**
   * @remarks
   * Name shown for an item.
   * 
   * Sample Values:
   * Apple: "item.apple.name"
   *
   * Breeze Rod: "item.breeze_rod.name"
   *
   * Ominous Trial Key: "item.ominous_trial_key.name"
   *
   */
  value: string;

}