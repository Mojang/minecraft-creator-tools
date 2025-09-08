// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:type_family
 * 
 * minecraft:type_family Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:type_family": {
  "family": [
    "allay",
    "mob"
  ]
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:type_family": {
  "family": [
    "armadillo",
    "mob"
  ]
}


Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

"minecraft:type_family": {
  "family": [
    "armor_stand",
    "inanimate",
    "mob"
  ]
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:type_family": {
  "family": [
    "aquatic",
    "axolotl",
    "mob"
  ]
}


Bat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bat.json

"minecraft:type_family": {
  "family": [
    "bat",
    "mob"
  ]
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:type_family": {
  "family": [
    "blaze",
    "monster",
    "mob"
  ]
}


Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:type_family": {
  "family": [
    "boat",
    "inanimate"
  ]
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:type_family": {
  "family": [
    "bogged",
    "skeleton",
    "monster",
    "mob",
    "undead"
  ]
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:type_family": {
  "family": [
    "breeze",
    "monster",
    "mob"
  ]
}


Breeze Wind Charge Projectile - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze_wind_charge_projectile.json

"minecraft:type_family": {
  "family": [
    "wind_charge",
    "wind_charge_projectile"
  ]
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:type_family": {
  "family": [
    "camel",
    "mob"
  ]
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:type_family": {
  "family": [
    "cat",
    "mob"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Type Family (minecraft:type_family)
 * Defines the families this entity belongs to.
 */
export default interface MinecraftTypeFamily {

  /**
   * @remarks
   * A set of tags that describe the categories of this entity. In
   * addition to typically having a tag for the type of mob, entities
   * frequently have additional type family tags that modify how the
   * rest of the Minecraft world reacts to them.
   * 
   * Sample Values:
   * Allay: ["allay","mob"]
   *
   * Armadillo: ["armadillo","mob"]
   *
   * Armor Stand: ["armor_stand","inanimate","mob"]
   *
   */
  family?: string[];

}


export enum MinecraftTypeFamilyFamily {
  Mob = `mob`,
  Inanimate = `inanimate`,
  Aquatic = `aquatic`,
  Monster = `monster`,
  Undead = `undead`,
  Skeleton = `skeleton`,
  Arthropod = `arthropod`,
  Zombie = `zombie`,
  Lightweight = `lightweight`,
  Fish = `fish`,
  Player = `player`
}