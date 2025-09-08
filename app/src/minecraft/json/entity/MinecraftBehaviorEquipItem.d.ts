// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.equip_item
 * 
 * minecraft:behavior.equip_item Samples

Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.equip_item": {
  "priority": 3
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.equip_item": {
  "priority": 2
}


Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.equip_item": {
  "priority": 5
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Equip Item Behavior (minecraft:behavior.equip_item)
 * The entity puts on the desired equipment.
 */
export default interface MinecraftBehaviorEquipItem {

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Bogged: 3
   *
   *
   * Fox: 2
   *
   *
   * Piglin: 5
   *
   */
  priority?: number;

}