// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Block Components Documentation - minecraft:entity_fall_on
 * 
 * minecraft:entity_fall_on Samples

Fall Distance Of 2 Blocks - Fall Distance of 2 Blocks

"minecraft:entity_fall_on": {
  "minimum_fall_distance": 2
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Entity Fall On (minecraft:entity_fall_on)
 * Configures what distance an entity must fall onto this block to
 * cause the `onEntityFallOn` block custom component event to be
 * sent to script. Custom components subscribed to the
 * `onEntityFallOn` event on a block without the
 * `minecraft:entity_fall_on` component use the default fall
 * distance of 1 block.
 */
export default interface MinecraftEntityFallOn {

  /**
   * @remarks
   * The minimum distance in blocks that an entity needs to fall
   * before events are raised.
   * 
   * Sample Values:
   * Fall Distance Of 2 Blocks: 2
   *
   */
  minimum_fall_distance?: number;

}