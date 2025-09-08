// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:color
 * 
 * minecraft:color Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:color": {
  "value": 14
}


Sheep - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/sheep.json

 * At /minecraft:entity/component_groups/minecraft:sheep_white/minecraft:color/: 
"minecraft:color": {
  "value": 0
}

 * At /minecraft:entity/component_groups/minecraft:sheep_brown/minecraft:color/: 
"minecraft:color": {
  "value": 12
}

 * At /minecraft:entity/component_groups/minecraft:sheep_black/minecraft:color/: 
"minecraft:color": {
  "value": 15
}

 * At /minecraft:entity/component_groups/minecraft:sheep_gray/minecraft:color/: 
"minecraft:color": {
  "value": 7
}

 * At /minecraft:entity/component_groups/minecraft:sheep_light_gray/minecraft:color/: 
"minecraft:color": {
  "value": 8
}

 * At /minecraft:entity/component_groups/minecraft:sheep_pink/minecraft:color/: 
"minecraft:color": {
  "value": 6
}

 * At /minecraft:entity/component_groups/minecraft:sheep_blue/minecraft:color/: 
"minecraft:color": {
  "value": 11
}

 * At /minecraft:entity/component_groups/minecraft:sheep_light_blue/minecraft:color/: 
"minecraft:color": {
  "value": 3
}

 * At /minecraft:entity/component_groups/minecraft:sheep_cyan/minecraft:color/: 
"minecraft:color": {
  "value": 9
}

 * At /minecraft:entity/component_groups/minecraft:sheep_orange/minecraft:color/: 
"minecraft:color": {
  "value": 1
}

 * At /minecraft:entity/component_groups/minecraft:sheep_yellow/minecraft:color/: 
"minecraft:color": {
  "value": 4
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Color (minecraft:color)
 * Defines the entity's main color.
 * Note: This attribute only works on vanilla entities that have
 * predefined color values (sheep, llama, shulker).
 */
export default interface MinecraftColor {

  /**
   * @remarks
   * The Palette Color value of the entity.
   * 
   * Sample Values:
   * Cat: 14
   *
   * Sheep: 12, 15, 7, 8, 6, 11, 3, 9, 1, 4
   *
   */
  value?: number;

}