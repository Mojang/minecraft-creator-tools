// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:equip_item
 * 
 * minecraft:equip_item Samples

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:equip_item": {
  "excluded_items": [
    {
      "item": "minecraft:banner:15"
    }
  ]
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:equip_item": {}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:equip_item": {
  "can_wear_armor": false
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Equip Item (minecraft:equip_item)
 * The entity puts on the desired equipment.
 */
export default interface MinecraftEquipItem {

  can_wear_armor: string;

  /**
   * @remarks
   * List of items that the entity should not equip.
   * 
   * Sample Values:
   * Bogged: [{"item":"minecraft:banner:15"}]
   *
   *
   */
  excluded_items: string[];

}