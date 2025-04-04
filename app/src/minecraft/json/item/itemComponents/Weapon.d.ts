// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:weapon
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Weapon
 * Weapon Item Component. Added to every weapon item such as axe,
 * sword, trident, bow, crossbow.
 * IMPORTANT
 * This type is now deprecated, and no longer in use in the latest versions of Minecraft.
 * 
 */
export default interface Weapon {

  /**
   * @remarks
   * Trigger for letting you know when this item is used to hit a
   * block
   */
  on_hit_block: object;

  /**
   * @remarks
   * Trigger for letting you know when this item is used to hurt
   * another mob
   */
  on_hurt_entity: object;

  /**
   * @remarks
   * Trigger for letting you know when this item hit another actor, but
   * didn't do damage
   */
  on_not_hurt_entity: object;

}