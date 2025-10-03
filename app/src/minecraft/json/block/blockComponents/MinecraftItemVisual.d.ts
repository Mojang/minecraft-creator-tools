// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:item_visual
 * 
 * minecraft:item_visual Samples
"minecraft:item_visual": {
  "geometry": {
    "identifier": "minecraft:geometry.full_block"
  },
  "material_instances": {
    "*": {
      "texture": "dirt",
      "render_method": "opaque"
    }
  }
}


Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:item_visual": {
  "geometry": "geometry.mikeamm_gwve_fabricator_in_hand",
  "material_instances": {
    "*": {
      "texture": "mikeamm_gwve_fabricator_in_hand",
      "render_method": "alpha_test"
    }
  }
}


Die - https://github.com/microsoft/minecraft-samples/tree/main/custom_blocks/behavior_packs/custom_blocks/blocks/die.json

"minecraft:item_visual": {
  "geometry": "minecraft:geometry.full_block",
  "material_instances": {
    "*": {
      "texture": "die_red",
      "render_method": "opaque"
    }
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Visual (minecraft:item_visual)
 * The description identifier of the geometry and material used to
 * render the item of this block.
Experimental toggles required: Upcoming
 * Creator Features (in format versions before 1.21.50).
 */
export default interface MinecraftItemVisual {

  /**
   * @remarks
   * [Required] The "minecraft:geometry" component that will be used
   * for the item.
   * 
   * Sample Values:
   * Block Fabricator: "geometry.mikeamm_gwve_fabricator_in_hand"
   *
   * Die: "minecraft:geometry.full_block"
   *
   */
  geometry?: object[];

  /**
   * @remarks
   * [Required] The "minecraft:material_instances" component that will
   * be used for the item.
   * 
   * Sample Values:
   * Block Fabricator: {"*":{"texture":"mikeamm_gwve_fabricator_in_hand","render_method":"alpha_test"}}
   *
   * Die: {"*":{"texture":"die_red","render_method":"opaque"}}
   *
   */
  material_instances?: object[];

}