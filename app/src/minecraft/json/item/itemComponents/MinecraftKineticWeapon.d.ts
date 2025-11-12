// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:kinetic_weapon
 * 
 * minecraft:kinetic_weapon Samples

Copper Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/copper_spear.json

"minecraft:kinetic_weapon": {
  "delay": 13,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 0.82,
  "damage_conditions": {
    "max_duration": 250,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 100,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 80,
    "min_speed": 12
  }
}


Diamond Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/diamond_spear.json

"minecraft:kinetic_weapon": {
  "delay": 10,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 1.075,
  "damage_conditions": {
    "max_duration": 200,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 80,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 60,
    "min_speed": 10
  }
}


Golden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/golden_spear.json

"minecraft:kinetic_weapon": {
  "delay": 14,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 0.7,
  "damage_conditions": {
    "max_duration": 275,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 110,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 70,
    "min_speed": 13
  }
}


Iron Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/iron_spear.json

"minecraft:kinetic_weapon": {
  "delay": 12,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 0.95,
  "damage_conditions": {
    "max_duration": 225,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 90,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 50,
    "min_speed": 11
  }
}


Netherite Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/netherite_spear.json

"minecraft:kinetic_weapon": {
  "delay": 8,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 1.2,
  "damage_conditions": {
    "max_duration": 175,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 70,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 50,
    "min_speed": 9
  }
}


Stone Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/stone_spear.json

"minecraft:kinetic_weapon": {
  "delay": 14,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 0.82,
  "damage_conditions": {
    "max_duration": 275,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 110,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 90,
    "min_speed": 13
  }
}


Wooden Spear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/items/wooden_spear.json

"minecraft:kinetic_weapon": {
  "delay": 15,
  "reach": {
    "min": 2,
    "max": 4.5
  },
  "creative_reach": {
    "min": 2,
    "max": 7.5
  },
  "hitbox_margin": 0.25,
  "damage_multiplier": 0.7,
  "damage_conditions": {
    "max_duration": 300,
    "min_relative_speed": 4.6
  },
  "knockback_conditions": {
    "max_duration": 120,
    "min_speed": 5.1
  },
  "dismount_conditions": {
    "max_duration": 100,
    "min_speed": 14
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Item Kinetic Weapon (minecraft:kinetic_weapon)
 * Allows an item to deal kinetic damage and its effects. This
 * happens every tick while in use, in a straight line along the
 * user's view vector, with damage computed based on both the
 * user's and the target's velocity projected onto the view vector
 * (via a dot product). The more the user and target move toward each
 * other, and the more this movement is aligned with the user's view
 * vector, the higher the damage. After "damage_multiplier" and
 * "damage_modifier" are applied, the resulting damage is floored to
 * the nearest lower integer.
 */
export default interface MinecraftKineticWeapon {

  /**
   * @remarks
   * Defines the reach used when the user is in Creative Mode. Defaults to
   * "reach" if unspecified.
   * 
   * Sample Values:
   * Copper Spear: {"min":2,"max":7.5}
   *
   *
   */
  creative_reach?: MinecraftKineticWeaponCreativeReach;

  /**
   * @remarks
   * Conditions that need to be satisfied for damage to be applied. If
   * not specified, damage is not applied.
   * 
   * Sample Values:
   * Copper Spear: {"max_duration":250,"min_relative_speed":4.6}
   *
   * Diamond Spear: {"max_duration":200,"min_relative_speed":4.6}
   *
   * Golden Spear: {"max_duration":275,"min_relative_speed":4.6}
   *
   */
  damage_conditions?: MinecraftKineticWeaponDamageConditions;

  /**
   * @remarks
   * Value added to the the scaled dot product (after applying
   * "damage_multiplier").
   */
  damage_modifier?: number;

  /**
   * @remarks
   * Value multiplied to sum of the dot products of the user and
   * target's velocity vectors projected onto the view vector.
   * 
   * Sample Values:
   * Copper Spear: 0.82
   *
   * Diamond Spear: 1.075
   *
   * Golden Spear: 0.7
   *
   */
  damage_multiplier?: number;

  /**
   * @remarks
   * Time, in ticks, after which kinetic damage and its effects start
   * being applied.
   * 
   * Sample Values:
   * Copper Spear: 13
   *
   * Diamond Spear: 10
   *
   * Golden Spear: 14
   *
   */
  delay?: number;

  /**
   * @remarks
   * Conditions that need to be satisfied for riders to be
   * dismounted. If not specified, riders cannot be dismounted.
   * 
   * Sample Values:
   * Copper Spear: {"max_duration":80,"min_speed":12}
   *
   * Diamond Spear: {"max_duration":60,"min_speed":10}
   *
   * Golden Spear: {"max_duration":70,"min_speed":13}
   *
   */
  dismount_conditions?: MinecraftKineticWeaponDismountConditions;

  /**
   * @remarks
   * Added tolerance to the view vector raycast for detecting entity
   * collisions.
   * 
   * Sample Values:
   * Copper Spear: 0.25
   *
   *
   */
  hitbox_margin?: number;

  /**
   * @remarks
   * Conditions that need to be satisfied for knockback to be
   * applied. If not specified, knockback is not applied.
   * 
   * Sample Values:
   * Copper Spear: {"max_duration":100,"min_speed":5.1}
   *
   * Diamond Spear: {"max_duration":80,"min_speed":5.1}
   *
   * Golden Spear: {"max_duration":110,"min_speed":5.1}
   *
   */
  knockback_conditions?: MinecraftKineticWeaponKnockbackConditions;

  /**
   * @remarks
   * Defines the range (in blocks) along the user's view vector where
   * entities can be hit. Only targets within this distance are
   * considered. Block collisions between the user and target block
   * damage and its effects.
   * 
   * Sample Values:
   * Copper Spear: {"min":2,"max":4.5}
   *
   *
   */
  reach?: MinecraftKineticWeaponReach;

}


/**
 * Item Components FloatRange (FloatRange)
 */
export interface MinecraftKineticWeaponCreativeReach {

  max?: number;

  min?: number;

}


/**
 * Item Components Kinetic Weapon Kinetic Effect Conditions
 * (minecraft:kinetic_weapon kinetic_effect_conditions)
 * Conditions that need to be satisfied for a specific effect of a
 * kinetic weapon to be applied.
 */
export interface MinecraftKineticWeaponDamageConditions {

  /**
   * @remarks
   * Time, in ticks, during which the effect can be applied after
   * "delay" elapses. If negative, the effect is applied 
   * indefinitely.
   */
  max_duration?: number;

  /**
   * @remarks
   * Minimum relative speed of the user with respect to the target
   * (projected onto the view vector via a dot product) required for
   * the effect to be applied.
   */
  min_relative_speed?: number;

  /**
   * @remarks
   * Minimum user's speed (projected onto the view vector via a dot
   * product) required for the effect to be applied.
   */
  min_speed?: number;

}


/**
 * Item Components Kinetic Weapon Kinetic Effect Conditions
 * (minecraft:kinetic_weapon kinetic_effect_conditions)
 * Conditions that need to be satisfied for a specific effect of a
 * kinetic weapon to be applied.
 */
export interface MinecraftKineticWeaponDismountConditions {

  /**
   * @remarks
   * Time, in ticks, during which the effect can be applied after
   * "delay" elapses. If negative, the effect is applied 
   * indefinitely.
   */
  max_duration?: number;

  /**
   * @remarks
   * Minimum relative speed of the user with respect to the target
   * (projected onto the view vector via a dot product) required for
   * the effect to be applied.
   */
  min_relative_speed?: number;

  /**
   * @remarks
   * Minimum user's speed (projected onto the view vector via a dot
   * product) required for the effect to be applied.
   */
  min_speed?: number;

}


/**
 * Item Components Kinetic Weapon Kinetic Effect Conditions
 * (minecraft:kinetic_weapon kinetic_effect_conditions)
 * Conditions that need to be satisfied for a specific effect of a
 * kinetic weapon to be applied.
 */
export interface MinecraftKineticWeaponKnockbackConditions {

  /**
   * @remarks
   * Time, in ticks, during which the effect can be applied after
   * "delay" elapses. If negative, the effect is applied 
   * indefinitely.
   */
  max_duration?: number;

  /**
   * @remarks
   * Minimum relative speed of the user with respect to the target
   * (projected onto the view vector via a dot product) required for
   * the effect to be applied.
   */
  min_relative_speed?: number;

  /**
   * @remarks
   * Minimum user's speed (projected onto the view vector via a dot
   * product) required for the effect to be applied.
   */
  min_speed?: number;

}


/**
 * Item Components FloatRange (FloatRange)
 */
export interface MinecraftKineticWeaponReach {

  max?: number;

  min?: number;

}