// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:damage_absorption
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Damage Absorption Item 
 * (minecraft:damage_absorption)
 * It allows an item to absorb damage that would otherwise be
 * dealt to its wearer. For this to happen, the item needs to be
 * equipped in an armor slot. The absorbed damage reduces the
 * item's durability, with any excess damage being ignored. Because of
 * this, the item also needs a `minecraft:durability` 
 * component.
 */
export default interface MinecraftDamageAbsorption {

  /**
   * @remarks
   * List of damage causes that can be absorbed by the item. By
   * default, no damage cause is absorbed.
   */
  absorbable_causes: string[];

}