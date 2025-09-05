// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:bundle_interaction
 * 
 * minecraft:bundle_interaction Samples

Black Bundle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/black_bundle.json

"minecraft:bundle_interaction": {
  "num_viewable_slots": 12
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Bundle Interaction (minecraft:bundle_interaction)
 * [EXPERIMENTAL] Adds bundle-specific interactions and tooltip to
 * the item. Requires a "minecraft:storage_item" component.
 */
export default interface MinecraftBundleInteraction {

  /**
   * @remarks
   * The maximum number of slots in the bundle viewable by the
   * plater. Can be from 1 to 64. Default is 12.
   * 
   * Sample Values:
   * Black Bundle: 12
   *
   *
   */
  num_viewable_slots?: number;

}