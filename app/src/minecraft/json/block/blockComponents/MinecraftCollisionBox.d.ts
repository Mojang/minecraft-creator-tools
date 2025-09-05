// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:collision_box
 * 
 * minecraft:collision_box Samples
"minecraft:collision_box": {
  "origin": [
    -8,
    0,
    -8
  ],
  "size": [
    16,
    16,
    16
  ]
}


Block Fabricator - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/blocks/fabricator.block.json

"minecraft:collision_box": true

Block Leaf Pile - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/blocks/leaf_pile.block.json

"minecraft:collision_box": {
  "origin": [
    -8,
    2,
    -8
  ],
  "size": [
    16,
    4,
    16
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Collision Box (minecraft:collision_box)
 * Defines the area of the block that collides with entities. If
 * set to true, default values are used. If set to false, the
 * block's collision with entities is disabled. If this component is
 * omitted, default values are used.  If this component is
 * omitted, the default value for this component is true, which will
 * give your block the default values for its parameters (a
 * collision box the size/shape of a regular block).
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Boolean true/false`.

 */
export default interface MinecraftCollisionBox {

  /**
   * @remarks
   * Minimal position of the bounds of the collision box. "origin" is
   * specified as [x, y, z] and must be in the range (-8, 0, -8) to
   * (8, 16, 8), inclusive.
   * 
   * Sample Values:
   * Block Leaf Pile: [-8,2,-8]
   *
   */
  origin?: number[];

  /**
   * @remarks
   * Size of each side of the collision box. Size is specified as
   * [x, y, z]. "origin" + "size" must be in the range (-8, 0, -8) to
   * (8, 16, 8), inclusive.
   * 
   * Sample Values:
   * Block Leaf Pile: [16,4,16]
   *
   */
  size?: number[];

}