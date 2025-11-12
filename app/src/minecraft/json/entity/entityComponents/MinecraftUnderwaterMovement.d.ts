// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:underwater_movement
 * 
 * minecraft:underwater_movement Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:underwater_movement": {
  "value": 0.2
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:underwater_movement": {
  "value": 0.15
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:underwater_movement": {
  "value": 0.3
}


Fish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fish.json

"minecraft:underwater_movement": {
  "value": 0.1
}


Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/guardian.json

"minecraft:underwater_movement": {
  "value": 0.12
}


Nautilus - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/nautilus.json

 * At /minecraft:entity/component_groups/minecraft:nautilus_mounted/minecraft:underwater_movement/: 
"minecraft:underwater_movement": {
  "value": 0.055
}

 * At /minecraft:entity/component_groups/minecraft:nautilus_unmounted/minecraft:underwater_movement/: 
"minecraft:underwater_movement": {
  "value": 0.07
}


Pufferfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pufferfish.json

"minecraft:underwater_movement": {
  "value": 0.13
}


Skeleton Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/skeleton_horse.json

"minecraft:underwater_movement": {
  "value": 0.08
}


Turtle - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/turtle.json

 * At /minecraft:entity/component_groups/minecraft:baby/minecraft:underwater_movement/: 
"minecraft:underwater_movement": {
  "value": 0.06
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Underwater Movement (minecraft:underwater_movement)
 * Defines the speed with which an entity can move through 
 * water.
 */
export default interface MinecraftUnderwaterMovement {

  /**
   * @remarks
   * Movement speed of the entity under water.
   * 
   * Sample Values:
   * Axolotl: 0.2
   *
   * Dolphin: 0.15
   *
   * Elder Guardian: 0.3
   *
   */
  value?: number;

}