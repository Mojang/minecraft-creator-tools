// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:breathable
 * 
 * minecraft:breathable Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:breathable": {
  "totalSupply": 15,
  "suffocateTime": 0
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:breathable": {
  "total_supply": 15,
  "suffocate_time": 0
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:breathable": {
  "total_supply": 15,
  "suffocate_time": 0,
  "breathes_water": true,
  "breathes_air": true,
  "generates_bubbles": false
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:breathable": {
  "totalSupply": 0,
  "suffocateTime": -1
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:breathable": {
  "total_supply": 15,
  "suffocate_time": 0,
  "breathes_water": true
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:breathable": {
  "total_supply": 240,
  "suffocate_time": 0,
  "breathes_air": true,
  "breathes_water": false,
  "generates_bubbles": false
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:breathable": {
  "total_supply": 15,
  "suffocate_time": 0,
  "breathes_air": true,
  "breathes_water": true
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:breathable": {
  "breathes_water": true
}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:breathable": {
  "total_supply": 15,
  "suffocate_time": 0,
  "breathes_air": false,
  "breathes_water": true
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/component_groups/minecraft:baby/minecraft:breathable/: 
"minecraft:breathable": {
  "total_supply": 5,
  "suffocate_time": 0,
  "breathes_air": true,
  "breathes_water": true
}

 * At /minecraft:entity/component_groups/minecraft:adult/minecraft:breathable/: 
"minecraft:breathable": {
  "total_supply": 5,
  "suffocate_time": 0,
  "breathes_air": true,
  "breathes_water": false
}


Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

"minecraft:breathable": {
  "total_supply": 15,
  "suffocate_time": 0,
  "breathes_lava": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Breathable (minecraft:breathable)
 * Defines what blocks this entity can breathe in and gives them the
 * ability to suffocate.
 */
export default interface MinecraftBreathable {

  /**
   * @remarks
   * List of blocks this entity can breathe in, in addition to the
   * selected items above.
   */
  breathe_blocks: string[];

  /**
   * @remarks
   * If set, this entity can breathe in air.
   * 
   * Sample Values:
   * Axolotl: true
   *
   *
   */
  breathes_air: boolean;

  /**
   * @remarks
   * If set, this entity can breathe in lava.
   * 
   * Sample Values:
   * Magma Cube: true
   *
   */
  breathes_lava: boolean;

  /**
   * @remarks
   * If set, this entity can breathe in solid blocks.
   */
  breathes_solids: boolean;

  /**
   * @remarks
   * If set, this entity can breathe in water.
   * 
   * Sample Values:
   * Axolotl: true
   *
   *
   */
  breathes_water: boolean;

  /**
   * @remarks
   * If set, this entity will have visible bubbles while in 
   * water.
   */
  generates_bubbles: boolean;

  /**
   * @remarks
   * Time in seconds to recover breath to maximum.
   * 
   * Sample Values:
   * Player: 3.75
   *
   */
  inhale_time: number;

  /**
   * @remarks
   * List of blocks this entity cannot breathe in, in addition to
   * the selected items above.
   */
  non_breathe_blocks: string[];

  /**
   * @remarks
   * Time in seconds between suffocation damage.
   * 
   * Sample Values:
   * Player: -1
   *
   */
  suffocate_time: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: -1
   *
   */
  suffocateTime: number;

  /**
   * @remarks
   * Time in seconds the entity can hold its breath.
   * 
   * Sample Values:
   * Armadillo: 15
   *
   *
   * Dolphin: 240
   *
   * Happy Ghast: 5
   *
   */
  total_supply: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Allay: 15
   *
   *
   */
  totalSupply: number;

}