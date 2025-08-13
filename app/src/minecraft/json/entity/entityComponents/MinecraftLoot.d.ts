// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:loot
 * 
 * minecraft:loot Samples

Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

"minecraft:loot": {
  "table": "loot_tables/entities/armor_stand.json"
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:loot": {
  "table": "loot_tables/entities/blaze.json"
}


Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:loot": {
  "table": "loot_tables/entities/boat.json"
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:loot": {
  "table": "loot_tables/entities/bogged.json"
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:loot": {
  "table": "loot_tables/entities/breeze.json"
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:loot": {
  "table": "loot_tables/entities/cat.json"
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:loot": {
  "table": "loot_tables/entities/spider.json"
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:loot": {
  "table": "loot_tables/entities/chicken.json"
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:loot": {
  "table": "loot_tables/entities/copper_golem.json"
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

"minecraft:loot": {
  "table": "loot_tables/entities/cow.json"
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:loot": {
  "table": "loot_tables/entities/creeper.json"
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:loot": {
  "table": "loot_tables/entities/dolphin.json"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Loot (minecraft:loot)
 * Sets the loot table for what items this entity drops upon 
 * death.
 * Note: Requires a loot table to be used when dropping items upon
 * death.
 */
export default interface MinecraftLoot {

  /**
   * @remarks
   * The path to the loot table, relative to the Behavior Pack's 
   * root.
   * 
   * Sample Values:
   * Armor Stand: "loot_tables/entities/armor_stand.json"
   *
   * Blaze: "loot_tables/entities/blaze.json"
   *
   * Boat: "loot_tables/entities/boat.json"
   *
   */
  table: string;

}