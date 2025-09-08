// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:selection_box
 * 
 * minecraft:selection_box Samples

Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:selection_box": true
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Selection Box (minecraft:selection_box)
 * Defines the area of the block that is selected by the player's
 * cursor. If set to true, default values are used. If set to
 * false, this block is not selectable by the player's cursor. If
 * this component is omitted, default values are used.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftSelectionBox {

  /**
   * @remarks
   * Minimal position of the bounds of the selection box. "origin" is
   * specified as [x, y, z] and must be in the range (-8, 0, -8) to
   * (8, 16, 8), inclusive.
   */
  origin?: number[];

  /**
   * @remarks
   * Size of each side of the selection box. Size is specified as
   * [x, y, z]. "origin" + "size" must be in the range (-8, 0, -8) to
   * (8, 16, 8), inclusive.
   */
  size?: number[];

}