// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:liquid_detection
 * 
 * minecraft:liquid_detection Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:liquid_detection": {
  "detection_rules": [
    {
      "liquid_type": "water",
      "on_liquid_touches": "broken"
    }
  ]
}


Block Leaf Pile - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/blocks/leaf_pile.block.json

"minecraft:liquid_detection": {
  "detection_rules": [
    {
      "liquid_type": "water",
      "on_liquid_touches": "popped"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Liquid Detection (minecraft:liquid_detection)
 * The definitions for how a block behaves when detecting liquid. Only
 * one rule definition is allowed per liquid type - if multiple are
 * specified, the first will be used and the rest will be
 * ignored.
Experimental toggles required: Upcoming Creator Features (in
 * format versions before 1.21.60).
 */
export default interface MinecraftLiquidDetection {

  /**
   * @remarks
   * Whether this block can contain the liquid. For example, if the
   * liquid type is `water`, this means the block can be
   * waterlogged.
   */
  can_contain_liquid?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Block Fabricator: [{"liquid_type":"water","on_liquid_touches":"broken"}]
   *
   */
  detection_rules?: MinecraftLiquidDetectionDetectionRules[];

  /**
   * @remarks
   * The type of liquid this detection rule is for. Currently, `water` is
   * the only supported liquid type. If this field is omitted, `water`
   * will be the liquid type by default.
   */
  liquid_type?: string;

  /**
   * @remarks
   * How the block reacts to flowing water. Must be one of the
   * following options:
"blocking" - The default value for this field.
   * The block stops the liquid from flowing.
"broken" - The block is
   * destroyed completely.
"popped" - The block is destroyed and its
   * item is spawned.
"no_reaction" - The block is unaffected; visually,
   * the liquid will flow through the block.
   */
  on_liquid_touches?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * When a block contains a liquid, controls the directions in
   * which the liquid can't flow out from the block. Also controls the
   * directions in which a block can stop liquid flowing into it if
   * `no_reaction` is set for the `on_liquid_touches` field. Can be
   * a list of the following directions: "up", "down", "north", "south",
   * "east", "west". The default is an empty list; this means that
   * liquid can flow out of all directions by default.
   */
  stops_liquid_flowing_from_direction?: string[];

}


/**
 * Detection rules (detection_rules)
 */
export interface MinecraftLiquidDetectionDetectionRules {

  /**
   * @remarks
   * 
   * Sample Values:
   * Block Fabricator: "water"
   *
   */
  liquid_type?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Block Fabricator: "broken"
   *
   */
  on_liquid_touches?: string;

}