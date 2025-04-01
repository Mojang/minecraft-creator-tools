// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:pushable
 * 
 * minecraft:pushable Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:pushable": {
  "is_pushable": true,
  "is_pushable_by_piston": true
}


Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

"minecraft:pushable": {
  "is_pushable": false,
  "is_pushable_by_piston": true
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:immobile/minecraft:pushable/: 
"minecraft:pushable": {
  "is_pushable": false,
  "is_pushable_by_piston": false
}


Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:pushable": {}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Pushable (minecraft:pushable)
 * Defines what can push an entity between other entities and
 * pistons.
 */
export default interface MinecraftPushable {

  /**
   * @remarks
   * Whether the entity can be pushed by other entities.
   * 
   * Sample Values:
   * Allay: true
   *
   *
   */
  is_pushable: boolean;

  /**
   * @remarks
   * Whether the entity can be pushed by pistons safely.
   * 
   * Sample Values:
   * Allay: true
   *
   *
   */
  is_pushable_by_piston: boolean;

}