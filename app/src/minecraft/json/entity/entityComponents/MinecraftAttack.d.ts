// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:attack
 * 
 * minecraft:attack Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:attack": {
  "damage": 2
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/normal_attack/minecraft:attack/: 
"minecraft:attack": {
  "damage": 2,
  "effect_name": "poison",
  "effect_duration": 10
}

 * At /minecraft:entity/component_groups/hard_attack/minecraft:attack/: 
"minecraft:attack": {
  "damage": 2,
  "effect_name": "poison",
  "effect_duration": 18
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:attack": {
  "damage": 6
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:attack": {
  "damage": 3
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_poison_easy/minecraft:attack/: 
"minecraft:attack": {
  "damage": 2,
  "effect_name": "poison",
  "effect_duration": 0
}

 * At /minecraft:entity/component_groups/minecraft:spider_poison_normal/minecraft:attack/: 
"minecraft:attack": {
  "damage": 2,
  "effect_name": "poison",
  "effect_duration": 7
}

 * At /minecraft:entity/component_groups/minecraft:spider_poison_hard/minecraft:attack/: 
"minecraft:attack": {
  "damage": 2,
  "effect_name": "poison",
  "effect_duration": 15
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:attack": {
  "damage": 5
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:attack": {
  "damage": 7
}


Goat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/goat.json

 * At /minecraft:entity/component_groups/goat_baby/minecraft:attack/: 
"minecraft:attack": {
  "damage": 1
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

 * At /minecraft:entity/component_groups/minecraft:hoglin_adult/minecraft:attack/: 
"minecraft:attack": {
  "damage": [
    3,
    9
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Attack (minecraft:attack)
 * Allows an entity to define an entity's melee attack and any
 * additional effects on it's attack.
 */
export default interface MinecraftAttack {

  /**
   * @remarks
   * Range of the random amount of damage the melee attack deals. A
   * negative value can heal the entity instead of hurting it.
   * 
   * Sample Values:
   * Axolotl: 2
   *
   *
   * Blaze: 6
   *
   * Bogged: 3
   *
   */
  damage?: number[];

  /**
   * @remarks
   * Duration in seconds of the status ailment applied to the damaged
   * entity.
   * 
   * Sample Values:
   * Bee: 10, 18
   *
   * Cave Spider: 7, 15
   *
   */
  effect_duration?: number;

  /**
   * @remarks
   * Identifier of the status ailment to apply to an entity attacked by
   * this entity's melee attack.
   * 
   * Sample Values:
   * Bee: "poison"
   *
   * Husk: "hunger"
   *
   * Stray: "slowness"
   *
   */
  effect_name?: string;

}