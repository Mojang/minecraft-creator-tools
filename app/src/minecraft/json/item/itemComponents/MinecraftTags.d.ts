// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:tags
 * 
 * minecraft:tags Samples

Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:tags": {
  "tags": [
    "minecraft:is_food"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Tags (minecraft:tags)
 * The tags component specifies which tags an item has on it.
 */
export default interface MinecraftTags {

  /**
   * @remarks
   * An array that can contain multiple item tags.
   * 
   * Sample Values:
   * Apple: ["minecraft:is_food"]
   *
   *
   */
  tags?: string[];

}