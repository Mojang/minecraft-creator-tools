// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:mark_variant
 * 
 * minecraft:mark_variant Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:mark_variant": {
  "value": 1
}


Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/horse.json

 * At /minecraft:entity/component_groups/minecraft:markings_none/minecraft:mark_variant/: 
"minecraft:mark_variant": {
  "value": 0
}

 * At /minecraft:entity/component_groups/minecraft:markings_white_fields/minecraft:mark_variant/: 
"minecraft:mark_variant": {
  "value": 2
}

 * At /minecraft:entity/component_groups/minecraft:markings_white_dots/minecraft:mark_variant/: 
"minecraft:mark_variant": {
  "value": 3
}

 * At /minecraft:entity/component_groups/minecraft:markings_black_dots/minecraft:mark_variant/: 
"minecraft:mark_variant": {
  "value": 4
}


Tropicalfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/tropicalfish.json

 * At /minecraft:entity/component_groups/minecraft:tropicalfish_variant_pattern_6/minecraft:mark_variant/: 
"minecraft:mark_variant": {
  "value": 5
}


Zombie Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_villager_v2.json

 * At /minecraft:entity/component_groups/taiga_villager/minecraft:mark_variant/: 
"minecraft:mark_variant": {
  "value": 6
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Mark Variant (minecraft:mark_variant)
 * Mark Variant is typically used as an additional per-type way
 * (besides `variant`) to express a different visual form of the
 * same mob.
 */
export default interface MinecraftMarkVariant {

  /**
   * @remarks
   * The Id of the mark_variant. By convention, 0 is the Id of the
   * base entity.
   * 
   * Sample Values:
   * Bee: 1
   *
   * Horse: 2, 3, 4
   *
   */
  value?: number;

}