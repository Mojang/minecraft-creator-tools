// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.follow_mob
 * 
 * minecraft:behavior.follow_mob Samples

Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:behavior.follow_mob": {
  "priority": 6,
  "search_range": 16,
  "stop_distance": 5,
  "speed_multiplier": 1.1,
  "use_home_position_restriction": true,
  "preferred_actor_type": "player",
  "filters": {
    "all_of": [
      {
        "test": "is_underwater",
        "subject": "other",
        "value": false
      },
      {
        "test": "is_baby",
        "subject": "other",
        "value": false
      },
      {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "armadillo"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "bee"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "camel"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "cat"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "chicken"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "cow"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "donkey"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "fox"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "goat"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "happy_ghast"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "horse"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "skeleton_horse"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "llama"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "mule"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "ocelot"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "panda"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "parrot"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "pig"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "polar_bear"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "rabbit"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "sheep"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "sniffer"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "strider"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "villager"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "villager_v2"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "wolf"
          }
        ]
      }
    ]
  }
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

"minecraft:behavior.follow_mob": {
  "priority": 4,
  "speed_multiplier": 1,
  "stop_distance": 3,
  "search_range": 20
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Follow Mob Behavior (minecraft:behavior.follow_mob)
 * Allows the mob to follow other mobs.
 */
export default interface MinecraftBehaviorFollowMob {

  /**
   * @remarks
   * If non-empty, provides criteria for filtering which nearby Mobs
   * can be followed. If empty default criteria will be used, which
   * will exclude Players, Squid variants, Fish variants, Tadpoles,
   * Dolphins, and mobs of the same type as the owner of the 
   * Goal.
   * 
   * Sample Values:
   * Happy Ghast: {"all_of":[{"test":"is_underwater","subject":"other","value":false},{"test":"is_baby","subject":"other","value":false},{"any_of":[{"test":"is_family","subject":"other","value":"player"},{"test":"is_family","subject":"other","value":"armadillo"},{"test":"is_family","subject":"other","value":"bee"},{"test":"is_family","subject":"other","value":"camel"},{"test":"is_family","subject":"other","value":"cat"},{"test":"is_family","subject":"other","value":"chicken"},{"test":"is_family","subject":"other","value":"cow"},{"test":"is_family","subject":"other","value":"donkey"},{"test":"is_family","subject":"other","value":"fox"},{"test":"is_family","subject":"other","value":"goat"},{"test":"is_family","subject":"other","value":"happy_ghast"},{"test":"is_family","subject":"other","value":"horse"},{"test":"is_family","subject":"other","value":"skeleton_horse"},{"test":"is_family","subject":"other","value":"llama"},{"test":"is_family","subject":"other","value":"mule"},{"test":"is_family","subject":"other","value":"ocelot"},{"test":"is_family","subject":"other","value":"panda"},{"test":"is_family","subject":"other","value":"parrot"},{"test":"is_family","subject":"other","value":"pig"},{"test":"is_family","subject":"other","value":"polar_bear"},{"test":"is_family","subject":"other","value":"rabbit"},{"test":"is_family","subject":"other","value":"sheep"},{"test":"is_family","subject":"other","value":"sniffer"},{"test":"is_family","subject":"other","value":"strider"},{"test":"is_family","subject":"other","value":"villager"},{"test":"is_family","subject":"other","value":"villager_v2"},{"test":"is_family","subject":"other","value":"wolf"}]}]}
   *
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The type of actor to prefer following. If left unspecified, a
   * random actor among those in range will be chosen.
   * 
   * Sample Values:
   * Happy Ghast: "player"
   *
   */
  preferred_actor_type?: string;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Happy Ghast: 6
   *
   * Parrot: 4
   *
   */
  priority?: number;

  /**
   * @remarks
   * The distance in blocks it will look for a mob to follow
   * 
   * Sample Values:
   * Happy Ghast: 16
   *
   * Parrot: 20
   *
   */
  search_range?: number;

  /**
   * @remarks
   * Movement speed multiplier of the mob when using this AI Goal
   * 
   * Sample Values:
   * Happy Ghast: 1.1
   *
   * Parrot: 1
   *
   */
  speed_multiplier?: number;

  /**
   * @remarks
   * The distance in blocks this mob stops from the mob it is
   * following
   * 
   * Sample Values:
   * Happy Ghast: 5
   *
   * Parrot: 3
   *
   */
  stop_distance?: number;

  /**
   * @remarks
   * If true, the mob will respect the 'minecraft:home' component's
   * 'restriction_radius' field when choosing a target to follow. If
   * false, it will choose target position without considering home
   * restrictions.
   * 
   * Sample Values:
   * Happy Ghast: true
   *
   */
  use_home_position_restriction?: boolean;

}