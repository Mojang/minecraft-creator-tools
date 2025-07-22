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
"minecraft:tags": {
  "do_swing_animation": false,
  "launch_power_scale": 1,
  "max_draw_duration": 0,
  "max_launch_power": 1,
  "min_draw_duration": 0,
  "scale_power_by_draw_duration": false
}


Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:tags": {
  "tags": [
    "minecraft:is_food"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Tags Item (minecraft:tags)
 * Determines which tags are included on a given item.
 */
export default interface MinecraftTags {

  /**
   * @remarks
   * An array that can contain multiple item tags.
   * 
   * Sample Values:
   * Apple: ["minecraft:is_food"]
   *
   */
  tags: string[];

}