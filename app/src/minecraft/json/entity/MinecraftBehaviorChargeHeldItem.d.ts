// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.charge_held_item
 * 
 * minecraft:behavior.charge_held_item Samples

Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:behavior.charge_held_item": {
  "priority": 3,
  "items": [
    "minecraft:arrow"
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Charge Held Item Behavior 
 * (minecraft:behavior.charge_held_item)
 * Allows an entity to charge and use their held item.
 */
export default interface MinecraftBehaviorChargeHeldItem {

  /**
   * @remarks
   * The list of items that can be used to charge the held item. This
   * list is required and must have at least one item in it.
   * 
   * Sample Values:
   * Piglin: ["minecraft:arrow"]
   *
   *
   */
  items: string[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Piglin: 3
   *
   *
   */
  priority: number;

}