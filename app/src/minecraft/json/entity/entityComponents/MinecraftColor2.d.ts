// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:color2
 * 
 * minecraft:color2 Samples

Tropicalfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/tropicalfish.json

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_white/minecraft:color2/: 
"minecraft:color2": {
  "value": 0
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_orange/minecraft:color2/: 
"minecraft:color2": {
  "value": 1
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_magenta/minecraft:color2/: 
"minecraft:color2": {
  "value": 2
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_lightblue/minecraft:color2/: 
"minecraft:color2": {
  "value": 3
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_yellow/minecraft:color2/: 
"minecraft:color2": {
  "value": 4
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_lightgreen/minecraft:color2/: 
"minecraft:color2": {
  "value": 5
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_pink/minecraft:color2/: 
"minecraft:color2": {
  "value": 6
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_gray/minecraft:color2/: 
"minecraft:color2": {
  "value": 7
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_silver/minecraft:color2/: 
"minecraft:color2": {
  "value": 8
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_cyan/minecraft:color2/: 
"minecraft:color2": {
  "value": 9
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_purple/minecraft:color2/: 
"minecraft:color2": {
  "value": 10
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_blue/minecraft:color2/: 
"minecraft:color2": {
  "value": 11
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_brown/minecraft:color2/: 
"minecraft:color2": {
  "value": 12
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_green/minecraft:color2/: 
"minecraft:color2": {
  "value": 13
}

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_pattern_red/minecraft:color2/: 
"minecraft:color2": {
  "value": 14
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Color2 (minecraft:color2)
 * Defines the entity's second texture color.
 * Note: Only works on vanilla entities that have a second predefined
 * color values (tropical fish).
 */
export default interface MinecraftColor2 {

  /**
   * @remarks
   * The second Palette Color value of the entity.
   * 
   * Sample Values:
   * Tropicalfish: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
   *
   */
  value?: number;

}