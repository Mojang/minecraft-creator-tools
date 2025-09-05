// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:buoyant
 * 
 * minecraft:buoyant Samples

Xp Orb - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/xp_orb.json

"minecraft:buoyant": {
  "apply_gravity": false,
  "liquid_blocks": [
    "minecraft:flowing_water",
    "minecraft:water"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Buoyant (minecraft:buoyant)
 * Enables an entity to float on the specified liquid blocks.
 */
export default interface MinecraftBuoyant {

  /**
   * @remarks
   * Applies gravity each tick. Causes more of a wave simulation, but
   * will cause more gravity to be applied outside liquids.
   */
  apply_gravity?: boolean;

  /**
   * @remarks
   * Base buoyancy used to calculate how much will a mob float.
   */
  base_buoyancy?: number;

  /**
   * @remarks
   * Probability for a big wave hitting the entity. Only used if
   * `simulate_waves` is true.
   */
  big_wave_probability?: number;

  /**
   * @remarks
   * Multiplier for the speed to make a big wave. Triggered depending on
   * 'big_wave_probability'.
   */
  big_wave_speed?: number;

  /**
   * @remarks
   * How much an actor will be dragged down when the Buoyancy Component is
   * removed.
   */
  drag_down_on_buoyancy_removed?: number;

  /**
   * @remarks
   * List of blocks this entity can float on. Must be a liquid 
   * block.
   * 
   * Sample Values:
   * Xp Orb: ["minecraft:flowing_water","minecraft:water"]
   *
   */
  liquid_blocks?: string[];

  /**
   * @remarks
   * Should the movement simulate waves going through.
   */
  simulate_waves?: boolean;

}