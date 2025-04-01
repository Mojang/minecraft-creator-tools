// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:use_duration
 * 
 * minecraft:use_duration Samples

AppleEnchanted - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/appleEnchanted.json

"minecraft:use_duration": 32

Camera - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/camera.json

"minecraft:use_duration": 100000

Dried Kelp - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/dried_kelp.json

"minecraft:use_duration": 16

Honey Bottle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/honey_bottle.json

"minecraft:use_duration": 40
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Use Duration
 * This component determines how long the item takes to use when
 * used in combination with components like "shooter", "throwable", or
 * "food".
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Decimal number`.

 */
export default interface UseDuration {

  /**
   * @remarks
   * How long the item takes to use in seconds.
   */
  value: number;

}