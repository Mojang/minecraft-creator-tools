// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:strength
 * 
 * minecraft:strength Samples

Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

 * At /minecraft:entity/component_groups/minecraft:strength_1/minecraft:strength/: 
"minecraft:strength": {
  "value": 1,
  "max": 5
}

 * At /minecraft:entity/component_groups/minecraft:strength_2/minecraft:strength/: 
"minecraft:strength": {
  "value": 2,
  "max": 5
}

 * At /minecraft:entity/component_groups/minecraft:strength_3/minecraft:strength/: 
"minecraft:strength": {
  "value": 3,
  "max": 5
}

 * At /minecraft:entity/component_groups/minecraft:strength_4/minecraft:strength/: 
"minecraft:strength": {
  "value": 4,
  "max": 5
}

 * At /minecraft:entity/component_groups/minecraft:strength_5/minecraft:strength/: 
"minecraft:strength": {
  "value": 5,
  "max": 5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Strength (minecraft:strength)
 * Defines the entity's strength to carry items.
 */
export default interface MinecraftStrength {

  /**
   * @remarks
   * The maximum strength of this entity
   * 
   * Sample Values:
   * Frost Moose: 5
   *
   */
  max?: number;

  /**
   * @remarks
   * The initial value of the strength
   * 
   * Sample Values:
   * Frost Moose: 1, 2, 3, 4, 5
   *
   */
  value?: number;

}