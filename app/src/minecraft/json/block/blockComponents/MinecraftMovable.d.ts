// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:movable
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Movable (minecraft:movable)
 * The description identifier of the movable component
Experimental toggles
 * required: Upcoming Creator Features (in format versions before
 * 1.21.100).
 */
export default interface MinecraftMovable {

  /**
   * @remarks
   * [Required] How the block reacts to being pushed by another block
   * like a piston. Must be one of the following options:
"push_pull" -
   * The default value for this field. The block will be pushed and
   * pulled by a piston.
"push" - The block will only be pulled by
   * a piston and will ignore a sticky piston.
"popped" - The block is
   * destroyed when moved by a piston.
"immovable" - The block is
   * unaffected by a piston.
   */
  movement_type: string;

  /**
   * @remarks
   * [Optional] How the block should handle adjacent blocks around it
   * when being pushed by another block like a piston. Must be one of
   * the following options:
"same" - Adjacent blocks to this block
   * will be moved when moved. This excludes other blocks with the
   * "same" property. This will only work with the movement_type:
   * "push_pull".
"none" - The default and will not move adjacent 
   * blocks.
   */
  sticky: string;

}