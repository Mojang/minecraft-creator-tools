// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:scale
 * 
 * minecraft:scale Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:scale": {
  "value": 0.6
}


Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:scale": {
  "value": 0.5
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:scale": {
  "value": 0.45
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

 * At /minecraft:entity/component_groups/minecraft:cat_baby/minecraft:scale/: 
"minecraft:scale": {
  "value": 0.4
}

 * At /minecraft:entity/component_groups/minecraft:cat_adult/minecraft:scale/: 
"minecraft:scale": {
  "value": 0.8
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:scale": {
  "value": 0.65
}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:scale": {
  "value": 1
}


Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ghast.json

"minecraft:scale": {
  "value": 4.5
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/component_groups/minecraft:adult/minecraft:scale/: 
"minecraft:scale": {
  "value": 3.999
}

 * At /minecraft:entity/component_groups/minecraft:baby/minecraft:scale/: 
"minecraft:scale": {
  "value": 1.999
}


Pufferfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pufferfish.json

"minecraft:scale": {
  "value": 1.2
}


Salmon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/salmon.json

 * At /minecraft:entity/component_groups/scale_large/minecraft:scale/: 
"minecraft:scale": {
  "value": 1.5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Scale (minecraft:scale)
 * Sets the entity's visual size.
 */
export default interface MinecraftScale {

  /**
   * @remarks
   * The value of the scale. 1.0 means the entity will appear at the
   * scale they are defined in their model. Higher numbers make the
   * entity bigger.
   * 
   * Sample Values:
   * Armadillo: 0.6
   *
   * Axolotl: 0.5
   *
   *
   * Camel: 0.45
   *
   */
  value: number;

}