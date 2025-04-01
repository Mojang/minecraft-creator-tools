// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:collision_box
 * 
 * minecraft:collision_box Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:collision_box": {
  "width": 0.35,
  "height": 0.6
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:collision_box": {
  "width": 0.7,
  "height": 0.65
}


Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

"minecraft:collision_box": {
  "width": 0.5,
  "height": 1.975
}


Arrow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/arrow.json

"minecraft:collision_box": {
  "width": 0.25,
  "height": 0.25
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:collision_box": {
  "width": 0.75,
  "height": 0.42
}


Bat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bat.json

"minecraft:collision_box": {
  "width": 0.5,
  "height": 0.9
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:collision_box": {
  "width": 0.55,
  "height": 0.5
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:collision_box": {
  "width": 0.5,
  "height": 1.8
}


Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:collision_box": {
  "width": 1.4,
  "height": 0.455
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:collision_box": {
  "width": 0.6,
  "height": 1.9
}


Breeze Wind Charge Projectile - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze_wind_charge_projectile.json

"minecraft:collision_box": {
  "width": 0.3125,
  "height": 0.3125
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:collision_box": {
  "width": 0.6,
  "height": 1.77
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Collision Box (minecraft:collision_box)
 * Sets the width and height of the Entity's collision box.
 */
export default interface MinecraftCollisionBox {

  /**
   * @remarks
   * Height of the collision box in blocks. A negative value will be
   * assumed to be 0.
   * 
   * Sample Values:
   * Allay: 0.6
   *
   * Armadillo: 0.65
   *
   * Armor Stand: 1.975
   *
   */
  height: number;

  /**
   * @remarks
   * Width of the collision box in blocks. A negative value will be
   * assumed to be 0. Min value is -100000000.000000 Max value is
   * 100000000.000000
   * 
   * Sample Values:
   * Allay: 0.35
   *
   * Armadillo: 0.7
   *
   * Armor Stand: 0.5
   *
   */
  width: number;

}