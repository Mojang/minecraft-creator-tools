// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:cooldown
 * 
 * minecraft:cooldown Samples
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Cooldown (minecraft:cooldown)
 * Adds a cooldown to the item so that, after performing an action of
 * the specified "type", all items with a "minecraft:cooldown" component
 * in the same "category" become unable to perform that same type of
 * action for the number of seconds defined in "duration".
 */
export default interface MinecraftCooldown {

  /**
   * @remarks
   * All items sharing the same "category" are put on cooldown when an
   * action of the specified "type" is performed.
   */
  category: string;

  /**
   * @remarks
   * Duration of the cooldown, in seconds, before the item can
   * perform an action of the specified "type" again.
   */
  duration: number;

  /**
   * @remarks
   * The type of action the cooldown applies to. Options are mutually
   * exclusive, so cooldown for one type of action does not affect the
   * others. Values: "use" (when using an item), "attack" (when attack
   * with an item).
   */
  type?: string;

}


export enum MinecraftCooldownType {
  attack = `attack`,
  use = `use`
}