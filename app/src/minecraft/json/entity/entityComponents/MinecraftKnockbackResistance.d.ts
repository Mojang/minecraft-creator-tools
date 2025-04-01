// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:knockback_resistance
 * 
 * minecraft:knockback_resistance Samples

Armor Stand - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armor_stand.json

"minecraft:knockback_resistance": {
  "value": 1
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:knockback_resistance": {
  "value": 0
}


Ender Dragon - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_dragon.json

"minecraft:knockback_resistance": {
  "value": 100,
  "max": 100
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:knockback_resistance": {
  "value": 0.6
}


Ravager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ravager.json

"minecraft:knockback_resistance": {
  "value": 0.75
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Knockback Resistance (minecraft:knockback_resistance)
 * Compels an entity to resist being knocked backwards by a melee
 * attack.
 * NOTE: Alternate Simple Representations

 * This can also be represent as a simple `Decimal number`.

 */
export default interface MinecraftKnockbackResistance {

  /**
   * @remarks
   * Maximum potential knockback resistence that this has.
   * 
   * Sample Values:
   * Ender Dragon: 100
   *
   *
   */
  max: number;

  /**
   * @remarks
   * The amount of knockback resistance that an entity has.
   * 
   * Sample Values:
   * Armor Stand: 1
   *
   *
   * Ender Dragon: 100
   *
   * Hoglin: 0.6
   *
   */
  value: number;

}