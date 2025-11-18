// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:piercing_weapon
 * 
 * minecraft:piercing_weapon Samples

Copper Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/copper_spear.json

"minecraft:piercing_weapon": {
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Piercing Weapon (minecraft:piercing_weapon)
 * Allows an item to deal damage to all entities detected in a
 * straight line along the user's view vector. Items with this
 * component cannot destroy blocks, as the attack action always takes
 * priority, regardless of what the user is looking at.
 */
export default interface MinecraftPiercingWeapon {

  /**
   * @remarks
   * Defines the reach used when the user is in Creative Mode. Defaults to
   * "reach" if unspecified.
   * 
   * Sample Values:
   * Copper Spear: {"min":2,"max":7.5}
   *
   *
   */
  creative_reach?: MinecraftPiercingWeaponCreativeReach;

  /**
   * @remarks
   * Added tolerance to the view vector raycast for detecting entity
   * collisions.
   * 
   * Sample Values:
   * Copper Spear: 0.25
   *
   *
   */
  hitbox_margin?: number;

  /**
   * @remarks
   * Defines the range (in blocks) along the user's view vector where
   * entities can be hit. Only targets within this distance are
   * considered. Block collisions between the user and target block
   * damage and its effects.
   * 
   * Sample Values:
   * Copper Spear: {"min":2,"max":4.5}
   *
   *
   */
  reach?: MinecraftPiercingWeaponReach;

}


/**
 * Item Components FloatRange (FloatRange)
 */
export interface MinecraftPiercingWeaponCreativeReach {

  max?: number;

  min?: number;

}


/**
 * Item Components FloatRange (FloatRange)
 */
export interface MinecraftPiercingWeaponReach {

  max?: number;

  min?: number;

}