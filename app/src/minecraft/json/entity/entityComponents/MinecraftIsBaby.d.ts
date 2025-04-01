// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:is_baby
 * 
 * minecraft:is_baby Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:is_baby": {}


Villager V2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/play_schedule_villager/minecraft:behavior.play/friend_types/0/filters/all_of/1/: 
"minecraft:is_baby": {
  "test": "is_baby",
  "subject": "other",
  "operator": "==",
  "value": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Is Baby (minecraft:is_baby)
 * Sets that this entity is a baby. This is used to set the is_baby
 * value for use in query functions like Molang and Filters.
 */
export default interface MinecraftIsBaby {

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager V2: "=="
   *
   */
  operator: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager V2: "other"
   *
   */
  subject: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager V2: "is_baby"
   *
   */
  test: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager V2: true
   *
   */
  value: string;

}