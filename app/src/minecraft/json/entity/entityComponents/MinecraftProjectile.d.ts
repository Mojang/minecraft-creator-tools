// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:projectile
 * 
 * minecraft:projectile Samples

Breeze Wind Charge Projectile - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze_wind_charge_projectile.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 1,
      "knockback": true
    },
    "wind_burst_on_hit": {}
  },
  "power": 0.7,
  "gravity": 0,
  "inertia": 1,
  "liquid_inertia": 1,
  "uncertainty_base": 5,
  "uncertainty_multiplier": 4,
  "reflect_on_hurt": true,
  "ignored_entities": [
    "ender_crystal",
    "wind_charge_projectile",
    "breeze_wind_charge_projectile"
  ]
}


Wind Charge Projectile - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wind_charge_projectile.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 1,
      "max_critical_damage": 1,
      "knockback": true
    },
    "wind_burst_on_hit": {}
  },
  "power": 1.5,
  "gravity": 0,
  "inertia": 1,
  "liquid_inertia": 1,
  "uncertainty_base": 1,
  "uncertainty_multiplier": 0,
  "reflect_on_hurt": true,
  "multiple_targets": false,
  "reflect_immunity": 0.5,
  "ignored_entities": [
    "ender_crystal",
    "wind_charge_projectile",
    "breeze_wind_charge_projectile"
  ]
}


Dragon Fireball - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dragon_fireball.json

"minecraft:projectile": {
  "on_hit": {
    "spawn_aoe_cloud": {
      "radius": 6,
      "radius_on_use": 0,
      "potion": 23,
      "particle": "dragonbreath",
      "duration": 120,
      "color": [
        220,
        0,
        239
      ],
      "affect_owner": false,
      "reapplication_delay": 20
    },
    "remove_on_hit": {}
  },
  "power": 1.3,
  "gravity": 0,
  "inertia": 1,
  "anchor": 2,
  "offset": [
    0,
    0.5,
    0
  ],
  "semi_random_diff_damage": true,
  "uncertainty_base": 10,
  "reflect_on_hurt": true,
  "hit_sound": "explode"
}


Egg - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/egg.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 0,
      "knockback": true,
      "destroy_on_hit": true
    },
    "spawn_chance": {
      "first_spawn_chance": 8,
      "second_spawn_chance": 32,
      "first_spawn_count": 1,
      "second_spawn_count": 4,
      "spawn_definition": "minecraft:chicken",
      "spawn_baby": true,
      "on_spawn": [
        {
          "filters": {
            "test": "enum_property",
            "subject": "other",
            "domain": "minecraft:climate_variant",
            "value": "warm"
          },
          "event": "minecraft:hatch_warm"
        },
        {
          "filters": {
            "test": "enum_property",
            "subject": "other",
            "domain": "minecraft:climate_variant",
            "value": "cold"
          },
          "event": "minecraft:hatch_cold"
        }
      ]
    },
    "remove_on_hit": {},
    "particle_on_hit": {
      "particle_type": "iconcrack",
      "num_particles": 6,
      "on_entity_hit": true,
      "on_other_hit": true,
      "particle_item_name": {
        "brown_egg": {
          "test": "enum_property",
          "domain": "minecraft:climate_variant",
          "value": "warm"
        },
        "blue_egg": {
          "test": "enum_property",
          "domain": "minecraft:climate_variant",
          "value": "cold"
        }
      }
    }
  },
  "power": 1.5,
  "gravity": 0.03,
  "angle_offset": 0
}


Fireball - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fireball.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 6,
      "knockback": false,
      "semi_random_diff_damage": false
    },
    "definition_event": {
      "affect_projectile": true,
      "event_trigger": {
        "event": "minecraft:explode",
        "target": "self"
      }
    }
  },
  "power": 1.6,
  "gravity": 0,
  "inertia": 1,
  "liquid_inertia": 1,
  "uncertainty_base": 0,
  "uncertainty_multiplier": 0,
  "anchor": 2,
  "offset": [
    0,
    -1.5,
    0
  ],
  "reflect_on_hurt": true,
  "catch_fire": true
}


Fishing Hook - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fishing_hook.json

"minecraft:projectile": {
  "on_hit": {
    "stick_in_ground": {}
  }
}


Lingering Potion - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/lingering_potion.json

"minecraft:projectile": {
  "on_hit": {
    "douse_fire": {},
    "spawn_aoe_cloud": {
      "radius": 3,
      "radius_on_use": -0.5,
      "duration": 30,
      "reapplication_delay": 40
    },
    "remove_on_hit": {}
  },
  "power": 0.5,
  "gravity": 0.05,
  "angle_offset": -20,
  "hit_sound": "glass"
}


Llama Spit - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama_spit.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 1,
      "knockback": false
    },
    "remove_on_hit": {}
  },
  "power": 1.5,
  "gravity": 0.06,
  "inertia": 1,
  "uncertainty_base": 10,
  "uncertainty_multiplier": 4,
  "anchor": 1,
  "offset": [
    0,
    -0.1,
    0
  ],
  "reflect_on_hurt": true
}


Shulker Bullet - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/shulker_bullet.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 4,
      "knockback": true,
      "should_bounce": true
    },
    "mob_effect": {
      "effect": "levitation",
      "durationeasy": 200,
      "durationnormal": 200,
      "durationhard": 200,
      "amplifier": 0
    },
    "remove_on_hit": {},
    "particle_on_hit": {
      "particle_type": "largeexplode",
      "on_other_hit": true
    }
  },
  "hit_sound": "bullet.hit",
  "destroyOnHurt": true,
  "crit_particle_on_hurt": true,
  "power": 1.6,
  "gravity": 0.05,
  "uncertainty_base": 16,
  "uncertainty_multiplier": 4,
  "anchor": 1,
  "offset": [
    0,
    -0.1,
    0
  ],
  "homing": true
}


Small Fireball - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/small_fireball.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "damage": 5,
      "knockback": true,
      "catch_fire": true,
      "semi_random_diff_damage": false
    },
    "catch_fire": {
      "fire_affected_by_griefing": true
    },
    "remove_on_hit": {}
  },
  "power": 1.3,
  "gravity": 0,
  "inertia": 1,
  "liquid_inertia": 1,
  "anchor": 2,
  "offset": [
    0,
    0.5,
    0
  ],
  "semi_random_diff_damage": true,
  "uncertainty_base": 10,
  "reflect_on_hurt": true
}


Snowball - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/snowball.json

"minecraft:projectile": {
  "on_hit": {
    "impact_damage": {
      "filter": "blaze",
      "damage": 3,
      "knockback": true
    },
    "remove_on_hit": {},
    "particle_on_hit": {
      "particle_type": "snowballpoof",
      "num_particles": 6,
      "on_entity_hit": true,
      "on_other_hit": true
    }
  },
  "anchor": 1,
  "power": 1.5,
  "gravity": 0.03,
  "angle_offset": 0,
  "offset": [
    0,
    -0.1,
    0
  ]
}


Splash Potion - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/splash_potion.json

"minecraft:projectile": {
  "on_hit": {
    "douse_fire": {},
    "thrown_potion_effect": {},
    "remove_on_hit": {}
  },
  "power": 0.5,
  "gravity": 0.05,
  "angle_offset": -20,
  "hit_sound": "glass"
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Projectile (minecraft:projectile)
 * Allows the entity to be a thrown entity.
 */
export default interface MinecraftProjectile {

  /**
   * @remarks
   * 
   * Sample Values:
   * Dragon Fireball: 2
   *
   *
   * Llama Spit: 1
   *
   *
   */
  anchor?: number;

  /**
   * @remarks
   * Determines the angle at which the projectile is thrown
   * 
   * Sample Values:
   * Lingering Potion: -20
   *
   *
   */
  angle_offset?: number;

  /**
   * @remarks
   * If true, the entity hit will be set on fire
   * 
   * Sample Values:
   * Fireball: true
   *
   */
  catch_fire?: boolean;

  /**
   * @remarks
   * If true, the projectile will produce additional particles when a
   * critical hit happens
   * 
   * Sample Values:
   * Shulker Bullet: true
   *
   */
  crit_particle_on_hurt?: boolean;

  /**
   * @remarks
   * If true, this entity will be destroyed when hit
   */
  destroy_on_hurt?: boolean;

  /**
   * @remarks
   * 
   * Sample Values:
   * Shulker Bullet: true
   *
   */
  destroyOnHurt?: string;

  /**
   * @remarks
   * Entity Definitions defined here can't be hurt by the 
   * projectile
   */
  filter?: string;

  /**
   * @remarks
   * If true, whether the projectile causes fire is affected by the
   * mob griefing game rule
   */
  fire_affected_by_griefing?: boolean;

  /**
   * @remarks
   * The gravity applied to this entity when thrown. The higher the
   * value, the faster the entity falls
   * 
   * Sample Values:
   * Egg: 0.03
   *
   * Lingering Potion: 0.05
   *
   * Llama Spit: 0.06
   *
   */
  gravity?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Thrown Trident: "item.trident.hit_ground"
   *
   */
  hit_ground_sound?: string;

  /**
   * @remarks
   * If true, when hitting a vehicle, and there's at least one
   * passenger in the vehicle, the damage will be dealt to the
   * passenger closest to the projectile impact point. If there are
   * no passengers, this setting does nothing.
   */
  hit_nearest_passenger?: boolean;

  /**
   * @remarks
   * The sound that plays when the projectile hits something
   * 
   * Sample Values:
   * Dragon Fireball: "explode"
   *
   * Lingering Potion: "glass"
   *
   * Shulker Bullet: "bullet.hit"
   *
   */
  hit_sound?: string;

  /**
   * @remarks
   * If true, the projectile homes in to the nearest entity
   * 
   * Sample Values:
   * Shulker Bullet: true
   *
   */
  homing?: boolean;

  /**
   * @remarks
   * [EXPERIMENTAL] An array of strings defining the types of
   * entities that this entity does not collide with.
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: ["ender_crystal","wind_charge_projectile","breeze_wind_charge_projectile"]
   *
   *
   */
  ignored_entities?: string[];

  /**
   * @remarks
   * The fraction of the projectile's speed maintained every frame
   * while traveling in air
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 1
   *
   *
   */
  inertia?: number;

  /**
   * @remarks
   * If true, the projectile will be treated as dangerous to the
   * players
   * 
   * Sample Values:
   * Wither Skull Dangerous: true
   *
   */
  is_dangerous?: boolean;

  /**
   * @remarks
   * If true, the projectile will knock back the entity it hits
   */
  knockback?: boolean;

  /**
   * @remarks
   * If true, the entity hit will be struck by lightning
   */
  lightning?: boolean;

  /**
   * @remarks
   * The fraction of the projectile's speed maintained every frame
   * while traveling in water
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 1
   *
   *
   * Thrown Trident: 0.99
   *
   */
  liquid_inertia?: number;

  /**
   * @remarks
   * If true, the projectile can hit multiple entities per flight
   */
  multiple_targets?: boolean;

  /**
   * @remarks
   * The offset from the entity's anchor where the projectile will
   * spawn
   * 
   * Sample Values:
   * Dragon Fireball: [0,0.5,0]
   *
   * Fireball: [0,-1.5,0]
   *
   * Llama Spit: [0,-0.1,0]
   *
   */
  offset?: number[];

  /**
   * @remarks
   * Time in seconds that the entity hit will be on fire for
   */
  on_fire_time?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: {"impact_damage":{"damage":1,"knockback":true},"wind_burst_on_hit":{}}
   *
   * Wind Charge Projectile: {"impact_damage":{"damage":1,"max_critical_damage":1,"knockback":true},"wind_burst_on_hit":{}}
   *
   * Dragon Fireball: {"spawn_aoe_cloud":{"radius":6,"radius_on_use":0,"potion":23,"particle":"dragonbreath","duration":120,"color":[220,0,239],"affect_owner":false,"reapplication_delay":20},"remove_on_hit":{}}
   *
   */
  on_hit?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Particle to use upon collision
   */
  particle?: string;

  /**
   * @remarks
   * Defines the effect the arrow will apply to the entity it 
   * hits
   */
  potion_effect?: number;

  /**
   * @remarks
   * Determines the velocity of the projectile
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 0.7
   *
   * Wind Charge Projectile: 1.5
   *
   * Dragon Fireball: 1.3
   *
   */
  power?: number;

  /**
   * @remarks
   * During the specified time, in seconds, the projectile cannot be
   * reflected by hitting it
   * 
   * Sample Values:
   * Wind Charge Projectile: 0.5
   *
   */
  reflect_immunity?: number;

  /**
   * @remarks
   * If true, this entity will be reflected back when hit
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: true
   *
   *
   */
  reflect_on_hurt?: boolean;

  /**
   * @remarks
   * If true, damage will be randomized based on damage and speed
   * 
   * Sample Values:
   * Dragon Fireball: true
   *
   *
   */
  semi_random_diff_damage?: boolean;

  /**
   * @remarks
   * The sound that plays when the projectile is shot
   * 
   * Sample Values:
   * Wither Skull: "bow"
   *
   *
   */
  shoot_sound?: string;

  /**
   * @remarks
   * If true, the projectile will be shot towards the target of the
   * entity firing it
   */
  shoot_target?: boolean;

  /**
   * @remarks
   * If true, the projectile will bounce upon hit
   * 
   * Sample Values:
   * Thrown Trident: true
   *
   */
  should_bounce?: boolean;

  /**
   * @remarks
   * If true, the projectile will be treated like a splash potion
   */
  splash_potion?: boolean;

  /**
   * @remarks
   * Radius in blocks of the 'splash' effect
   */
  splash_range?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Thrown Trident: true
   *
   */
  stop_on_hurt?: string;

  /**
   * @remarks
   * The base accuracy. Accuracy is determined by the formula
   * uncertaintyBase - difficultyLevel * uncertaintyMultiplier
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 5
   *
   * Wind Charge Projectile: 1
   *
   * Dragon Fireball: 10
   *
   */
  uncertainty_base?: number;

  /**
   * @remarks
   * Determines how much difficulty affects accuracy. Accuracy is
   * determined by the formula uncertaintyBase - difficultyLevel *
   * uncertaintyMultiplier
   * 
   * Sample Values:
   * Breeze Wind Charge Projectile: 4
   *
   *
   * Wither Skull: 1
   *
   *
   */
  uncertainty_multiplier?: number;

}