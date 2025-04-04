// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:use_animation
 * 
 * minecraft:use_animation Samples

Apple - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/apple.json

"minecraft:use_animation": "eat
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Use Animation
 * Use_animation specifies which animation is played when the
 * player uses the item.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `String`.

 */
export default interface UseAnimation {

  /**
   * @remarks
   * Specifies which animation to play when the the item is used.
   */
  value: string;

}