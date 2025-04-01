// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:variant
 * 
 * minecraft:variant Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

 * At /minecraft:entity/component_groups/axolotl_lucy/minecraft:variant/: 
"minecraft:variant": {
  "value": 0
}

 * At /minecraft:entity/component_groups/axolotl_cyan/minecraft:variant/: 
"minecraft:variant": {
  "value": 1
}

 * At /minecraft:entity/component_groups/axolotl_gold/minecraft:variant/: 
"minecraft:variant": {
  "value": 2
}

 * At /minecraft:entity/component_groups/axolotl_wild/minecraft:variant/: 
"minecraft:variant": {
  "value": 3
}

 * At /minecraft:entity/component_groups/axolotl_blue/minecraft:variant/: 
"minecraft:variant": {
  "value": 4
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

 * At /minecraft:entity/component_groups/minecraft:cat_calico/minecraft:variant/: 
"minecraft:variant": {
  "value": 5
}

 * At /minecraft:entity/component_groups/minecraft:cat_persian/minecraft:variant/: 
"minecraft:variant": {
  "value": 6
}

 * At /minecraft:entity/component_groups/minecraft:cat_ragdoll/minecraft:variant/: 
"minecraft:variant": {
  "value": 7
}

 * At /minecraft:entity/component_groups/minecraft:cat_tabby/minecraft:variant/: 
"minecraft:variant": {
  "value": 8
}

 * At /minecraft:entity/component_groups/minecraft:cat_black/minecraft:variant/: 
"minecraft:variant": {
  "value": 9
}

 * At /minecraft:entity/component_groups/minecraft:cat_jellie/minecraft:variant/: 
"minecraft:variant": {
  "value": 10
}


Shulker - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/shulker.json

 * At /minecraft:entity/component_groups/minecraft:shulker_light_blue/minecraft:variant/: 
"minecraft:variant": {
  "value": 12
}

 * At /minecraft:entity/component_groups/minecraft:shulker_magenta/minecraft:variant/: 
"minecraft:variant": {
  "value": 13
}

 * At /minecraft:entity/component_groups/minecraft:shulker_orange/minecraft:variant/: 
"minecraft:variant": {
  "value": 14
}

 * At /minecraft:entity/component_groups/minecraft:shulker_undyed/minecraft:variant/: 
"minecraft:variant": {
  "value": 16
}

 * At /minecraft:entity/component_groups/minecraft:shulker_white/minecraft:variant/: 
"minecraft:variant": {
  "value": 15
}

 * At /minecraft:entity/component_groups/minecraft:shulker_yellow/minecraft:variant/: 
"minecraft:variant": {
  "value": 11
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Variant (minecraft:variant)
 * Variant is typically used as a per-type way to express a
 * different visual form of the same mob. For example, for cats,
 * variant is a number that defines the breed of cat.
 * Note: This behavior is a requirement for setting up multiple types
 * of variants for an entity.
 */
export default interface MinecraftVariant {

  /**
   * @remarks
   * The Id of the variant. By convention, 0 is the Id of the base
   * entity/default appearance.
   * 
   * Sample Values:
   * Axolotl: 1, 2, 3, 4
   *
   */
  value: number;

}