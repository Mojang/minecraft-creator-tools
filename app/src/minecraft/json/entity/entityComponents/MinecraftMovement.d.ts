// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:movement
 * 
 * minecraft:movement Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:movement": {
  "value": 0.1
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

 * At /minecraft:entity/component_groups/minecraft:unrolled/minecraft:movement/: 
"minecraft:movement": {
  "value": 0.14
}

 * At /minecraft:entity/component_groups/minecraft:rolled_up/minecraft:movement/: 
"minecraft:movement": {
  "value": 0
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:movement": {
  "value": 0.3
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:movement": {
  "value": 0.23
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:movement": {
  "value": 0.25
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:movement": {
  "value": 0.4
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:movement": {
  "value": 0.09
}


Copper Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/copper_golem.json

"minecraft:movement": {
  "value": 0.2
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

"minecraft:movement": {
  "value": 0.175
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

 * At /minecraft:entity/component_groups/minecraft:enderman_angry/minecraft:movement/: 
"minecraft:movement": {
  "value": 0.45
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:movement": {
  "value": 0.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Movement (minecraft:movement)
 * This component represents the foundational movement of an
 * entity.
 */
export default interface MinecraftMovement {

  max: number;

  /**
   * @remarks
   * The standard movement speed value.
   * 
   * Sample Values:
   * Allay: 0.1
   *
   * Armadillo: 0.14
   *
   *
   * Bee: 0.3
   *
   */
  value: number;

}