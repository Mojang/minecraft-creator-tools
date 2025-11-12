// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:burns_in_daylight
 * 
 * minecraft:burns_in_daylight Samples

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:burns_in_daylight": {}


Magma Cube - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/magma_cube.json

"minecraft:burns_in_daylight": false

Zombie Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_horse.json

"minecraft:burns_in_daylight": {
  "protection_slot": "slot.armor.body"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Entity Burns In Daylight (minecraft:burns_in_daylight)
 * .
 */
export default interface MinecraftBurnsInDaylight {

  /**
   * @remarks
   * 
   * Sample Values:
   * Zombie Horse: "slot.armor.body"
   *
   *
   */
  protection_slot?: string;

}


export enum MinecraftBurnsInDaylightProtectionSlot {
  slotArmorBody = `slot.armor.body`,
  slotArmorChest = `slot.armor.chest`,
  slotArmorFeet = `slot.armor.feet`,
  slotArmorHead = `slot.armor.head`,
  slotArmorLegs = `slot.armor.legs`,
  slotWeaponOffhand = `slot.weapon.offhand`
}