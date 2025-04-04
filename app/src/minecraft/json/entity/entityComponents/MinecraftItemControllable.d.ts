// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:item_controllable
 * 
 * minecraft:item_controllable Samples

Pig - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pig.json

"minecraft:item_controllable": {
  "control_items": "carrotOnAStick"
}


Strider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/strider.json

"minecraft:item_controllable": {
  "control_items": "warped_fungus_on_a_stick"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Controllable (minecraft:item_controllable)
 * Defines what items can be used to control this entity while
 * ridden.
 */
export default interface MinecraftItemControllable {

  /**
   * @remarks
   * List of items that can be used to control this entity.
   * 
   * Sample Values:
   * Pig: "carrotOnAStick"
   *
   * Strider: "warped_fungus_on_a_stick"
   *
   */
  control_items: string[];

}