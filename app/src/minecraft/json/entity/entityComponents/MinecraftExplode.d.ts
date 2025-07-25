// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:explode
 * 
 * minecraft:explode Samples

Breeze Wind Charge Projectile - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze_wind_charge_projectile.json

"minecraft:explode": {
  "power": 3,
  "particle_effect": "breeze_wind_burst",
  "sound_effect": "breeze_wind_charge.burst",
  "knockback_scaling": 0.6,
  "negates_fall_damage": false,
  "causes_fire": false,
  "breaks_blocks": false,
  "allow_underwater": true,
  "toggles_blocks": true,
  "damage_scaling": 0,
  "max_resistance": 0
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

 * At /minecraft:entity/component_groups/minecraft:exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 1.5,
  "fuse_lit": true,
  "power": 3,
  "causes_fire": false,
  "destroy_affected_by_griefing": true
}

 * At /minecraft:entity/component_groups/minecraft:charged_exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 1.5,
  "fuse_lit": true,
  "power": 6,
  "causes_fire": false,
  "destroy_affected_by_griefing": true
}


Ender Crystal - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/ender_crystal.json

"minecraft:explode": {
  "fuse_length": 0,
  "fuse_lit": true,
  "power": 6,
  "causes_fire": false,
  "destroy_affected_by_griefing": true
}


Fireball - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fireball.json

 * At /minecraft:entity/component_groups/minecraft:exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 0,
  "fuse_lit": true,
  "power": 1,
  "causes_fire": true,
  "fire_affected_by_griefing": true,
  "destroy_affected_by_griefing": true
}

 * At /minecraft:entity/events/minecraft:explode/: 
"minecraft:explode": {
  "add": {
    "component_groups": [
      "minecraft:exploding"
    ]
  }
}


Tnt Minecart - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/tnt_minecart.json

 * At /minecraft:entity/component_groups/minecraft:primed_tnt/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 4,
  "fuse_lit": true,
  "power": 3,
  "causes_fire": false
}

 * At /minecraft:entity/component_groups/minecraft:instant_explode_tnt/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 0,
  "fuse_lit": true,
  "power": 3,
  "causes_fire": false
}


Wind Charge Projectile - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wind_charge_projectile.json

"minecraft:explode": {
  "power": 1.2,
  "particle_effect": "wind_burst",
  "sound_effect": "wind_charge.burst",
  "knockback_scaling": 1.22,
  "negates_fall_damage": true,
  "causes_fire": false,
  "breaks_blocks": false,
  "allow_underwater": true,
  "toggles_blocks": true,
  "damage_scaling": 0,
  "max_resistance": 0
}


Wither Skull Dangerous - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither_skull_dangerous.json

 * At /minecraft:entity/component_groups/minecraft:exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 0,
  "fuse_lit": true,
  "power": 1,
  "causes_fire": false,
  "max_resistance": 4,
  "destroy_affected_by_griefing": true
}


Wither Skull - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wither_skull.json

 * At /minecraft:entity/component_groups/minecraft:exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 0,
  "fuse_lit": true,
  "power": 1,
  "causes_fire": false,
  "destroy_affected_by_griefing": true
}


Campghost - https://github.com/microsoft/minecraft-samples/tree/main/creator_camp/behavior_packs/creator_camp/entities/campghost.json

 * At /minecraft:entity/component_groups/minecraft:exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 1.5,
  "fuse_lit": true,
  "power": 3,
  "causes_fire": false,
  "destroy_affected_by_griefing": true,
  "sound_effect": "scary"
}

 * At /minecraft:entity/component_groups/minecraft:charged_exploding/minecraft:explode/: 
"minecraft:explode": {
  "fuse_length": 1.5,
  "fuse_lit": true,
  "power": 6,
  "causes_fire": false,
  "destroy_affected_by_griefing": true,
  "sound_effect": "scary"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Explode (minecraft:explode)
 * Defines how the entity explodes.
 */
export default interface MinecraftExplode {

  /**
   * @remarks
   * 
   * Sample Values:
   * Fireball: {"component_groups":["minecraft:exploding"]}
   *
   *
   */
  add: MinecraftExplodeAdd;

  /**
   * @remarks
   * If true, the explosion will affect blocks and entities under
   * water.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: true
   *
   *
   */
  allow_underwater: boolean;

  /**
   * @remarks
   * If true, the explosion will destroy blocks in the explosion 
   * radius.
   */
  breaks_blocks: boolean;

  /**
   * @remarks
   * If true, blocks in the explosion radius will be set on fire.
   * 
   * Sample Values:
   * Fireball: true
   *
   */
  causes_fire: boolean;

  /**
   * @remarks
   * A scale factor applied to the explosion's damage to entities. A
   * value of 0 prevents the explosion from dealing any damage. Negative
   * values cause the explosion to heal entities instead.
   */
  damage_scaling: number;

  /**
   * @remarks
   * If true, whether the explosion breaks blocks is affected by the
   * mob griefing game rule.
   * 
   * Sample Values:
   * Creeper: true
   *
   */
  destroy_affected_by_griefing: boolean;

  /**
   * @remarks
   * If true, whether the explosion causes fire is affected by the
   * mob griefing game rule.
   * 
   * Sample Values:
   * Fireball: true
   *
   */
  fire_affected_by_griefing: boolean;

  /**
   * @remarks
   * The range for the random amount of time the fuse will be lit
   * before exploding, a negative value means the explosion will be
   * immediate.
   * 
   * Sample Values:
   * Creeper: 1.5
   *
   * Tnt Minecart: 4
   *
   */
  fuse_length: number[];

  /**
   * @remarks
   * If true, the fuse is already lit when this component is added to
   * the entity.
   * 
   * Sample Values:
   * Creeper: true
   *
   */
  fuse_lit: boolean;

  /**
   * @remarks
   * A scale factor applied to the knockback force caused by the
   * explosion.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 0.6
   *
   * Wind Charge Projectile: 1.22
   *
   */
  knockback_scaling: number;

  /**
   * @remarks
   * A blocks explosion resistance will be capped at this value when
   * an explosion occurs.
   * 
   * Sample Values:
   * Wither Skull Dangerous: 4
   *
   */
  max_resistance: number;

  /**
   * @remarks
   * Defines whether the explosion should apply fall damage negation to
   * Players above the point of collision.
   * 
   * Sample Values:
   * Wind Charge Projectile: true
   *
   */
  negates_fall_damage: boolean;

  /**
   * @remarks
   * The name of the particle effect to use. The accepted strings are
   * 'explosion', 'wind_burst', or 'breeze_wind_burst'.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: "breeze_wind_burst"
   *
   * Wind Charge Projectile: "wind_burst"
   *
   */
  particle_effect: string;

  /**
   * @remarks
   * The radius of the explosion in blocks and the amount of damage the
   * explosion deals.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 3
   *
   * Creeper: 6
   *
   * Fireball: 1
   *
   */
  power: number;

  /**
   * @remarks
   * The name of the sound effect played when the explosion 
   * triggers.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: "breeze_wind_charge.burst"
   *
   * Wind Charge Projectile: "wind_charge.burst"
   *
   * Campghost: "scary"
   *
   */
  sound_effect: string;

  /**
   * @remarks
   * If true, the explosion will toggle blocks in the explosion 
   * radius.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: true
   *
   *
   */
  toggles_blocks: boolean;

}


/**
 * Add (add)
 */
export interface MinecraftExplodeAdd {

  /**
   * @remarks
   * 
   * Sample Values:
   * Fireball: ["minecraft:exploding"]
   *
   */
  component_groups: string;

}