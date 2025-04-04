// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.swim_up_for_breath
 * 
 * minecraft:behavior.swim_up_for_breath Samples

Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:behavior.swim_up_for_breath": {
  "priority": 1
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Swim Up For Breath Behavior 
 * (minecraft:behavior.swim_up_for_breath)
 * Allows the mob to try to move to air once it is close to
 * running out of its total breathable supply. Requires
 * "minecraft:breathable".
 */
export default interface MinecraftBehaviorSwimUpForBreath {

  /**
   * @remarks
   * The material the mob is traveling in. An air block will only be
   * considered valid to move to with a block of this material below
   * it. Options are: "water", "lava", or "any".
   */
  material_type: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Dolphin: 1
   *
   */
  priority: number;

  /**
   * @remarks
   * The height (in blocks) above the mob's current position that it
   * will search for a valid air block to move to. If a valid block
   * cannot be found, the mob will move to the position this many
   * blocks above it.
   */
  search_height: number;

  /**
   * @remarks
   * The radius (in blocks) around the mob's current position that it
   * will search for a valid air block to move to.
   */
  search_radius: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this Goal.
   */
  speed_mod: number;

}