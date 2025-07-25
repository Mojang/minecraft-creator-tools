// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:flammable
 * 
 * minecraft:flammable Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:flammable": {
  "destroy_chance_modifier": 20,
  "catch_chance_modifier": 5
}


Block Leaf Pile - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/blocks/leaf_pile.block.json

"minecraft:flammable": {
  "destroy_chance_modifier": 100,
  "catch_chance_modifier": 100
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Flammable (minecraft:flammable)
 * Describes the flammable properties for this block. If set to
 * true, default values are used. If set to false, or if this
 * component is omitted, the block will not be able to catch on
 * fire naturally from neighbors, but it can still be directly 
 * ignited.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftFlammable {

  /**
   * @remarks
   * A modifier affecting the chance that this block will catch flame
   * when next to a fire. Values are greater than or equal to 0,
   * with a higher number meaning more likely to catch on fire. For a
   * "catch_chance_modifier" greater than 0, the fire will continue to
   * burn until the block is destroyed (or it will burn forever if
   * the "destroy_chance_modifier" is 0). If the
   * "catch_chance_modifier" is 0, and the block is directly ignited, the
   * fire will eventually burn out without destroying the block (or
   * it will have a chance to be destroyed if
   * "destroy_chance_modifier" is greater than 0). The default value of
   * 5 is the same as that of Planks.
   * 
   * Sample Values:
   * Block Fabricator: 5
   *
   *
   * Block Leaf Pile: 100
   *
   */
  catch_chance_modifier: number;

  /**
   * @remarks
   * A modifier affecting the chance that this block will be
   * destroyed by flames when on fire. Values are greater than or
   * equal to 0, with a higher number meaning more likely to be
   * destroyed by fire. For a "destroy_chance_modifier" of 0, the
   * block will never be destroyed by fire, and the fire will burn
   * forever if the "catch_chance_modifier" is greater than 0. The
   * default value of 20 is the same as that of Planks.
   * 
   * Sample Values:
   * Block Fabricator: 20
   *
   *
   * Block Leaf Pile: 100
   *
   */
  destroy_chance_modifier: number;

}