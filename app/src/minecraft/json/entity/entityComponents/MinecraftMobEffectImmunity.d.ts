// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:mob_effect_immunity
 * 
 * minecraft:mob_effect_immunity Samples

Silverfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/silverfish.json

"minecraft:mob_effect_immunity": {
  "mob_effects": [
    "infested"
  ]
}


Slime - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/slime.json

"minecraft:mob_effect_immunity": {
  "mob_effects": [
    "oozing"
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Mob Effect Immunity (minecraft:mob_effect_immunity)
 * Entities with this component will have an immunity to the
 * provided mob effects.
 */
export default interface MinecraftMobEffectImmunity {

  /**
   * @remarks
   * List of names of effects the entity is immune to.
   * 
   * Sample Values:
   * Silverfish: ["infested"]
   *
   * Slime: ["oozing"]
   *
   */
  mob_effects?: string[];

}