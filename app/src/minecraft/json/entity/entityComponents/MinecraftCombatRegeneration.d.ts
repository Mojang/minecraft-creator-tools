// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:combat_regeneration
 * 
 * minecraft:combat_regeneration Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:combat_regeneration": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Combat Regeneration (minecraft:combat_regeneration)
 * Gives `Regeneration I` and removes `Mining Fatigue` from the mob
 * that kills the entity's attack target.
 */
export default interface MinecraftCombatRegeneration {

  /**
   * @remarks
   * Determines if the mob will grant mobs of the same type combat buffs
   * if they kill the target.
   */
  apply_to_family?: boolean;

  /**
   * @remarks
   * Determines if the mob will grant itself the combat buffs if it
   * kills the target.
   */
  apply_to_self?: boolean;

  /**
   * @remarks
   * The duration in seconds of Regeneration I added to the mob. Can
   * also be set to "infinite"
   */
  regeneration_duration?: number;

}