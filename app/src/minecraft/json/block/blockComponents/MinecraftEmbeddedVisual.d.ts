// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:embedded_visual
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Embedded Visual (minecraft:embedded_visual)
 * The description identifier of the geometry and material used to
 * render this block when it it is embedded inside of another block
 * (for example, a flower inside of a flower pot).
 */
export default interface MinecraftEmbeddedVisual {

  /**
   * @remarks
   * The "minecraft:geometry" component that will be used when
   * rendered inside of another block.
   */
  geometry: object[];

  /**
   * @remarks
   * The "minecraft:material_instances" component that will be used
   * when rendered inside of another block.
   */
  material_instances: object[];

}