// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:attack
 * 
 * minecraft:attack Samples

Biceson - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/biceson.behavior.json

"minecraft:attack": {
  "damage": 6
}


Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:attack": {
  "damage": 3
}


Axe Turret - https://github.com/microsoft/minecraft-samples/tree/main/casual_creator/gray_wave/behavior_packs/mikeamm_gwve/entities/axe_turret.behavior.json

"minecraft:attack": {
  "damage": 400
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Attack (minecraft:attack)
 * Allows an entity to define an entity's melee attack and any
 * additional effects on it's attack.
 */
export default interface MinecraftAttack {

  /**
   * @remarks
   * Range of the random amount of damage the melee attack deals. A
   * negative value can heal the entity instead of hurting it.
   * 
   * Sample Values:
   * Biceson: 6
   *
   * Sheepomelon: 3
   *
   *
   *
   * Axe Turret: 400
   *
   */
  damage?: number[];

  /**
   * @remarks
   * Duration in seconds of the status ailment applied to the damaged
   * entity.
   */
  effect_duration?: number;

  /**
   * @remarks
   * Identifier of the status ailment to apply to an entity attacked by
   * this entity's melee attack.
   */
  effect_name?: string;

}