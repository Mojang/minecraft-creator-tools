// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.nap
 * 
 * minecraft:behavior.nap Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:behavior.nap": {
  "priority": 8,
  "cooldown_min": 2,
  "cooldown_max": 7,
  "mob_detect_dist": 12,
  "mob_detect_height": 6,
  "can_nap_filters": {
    "all_of": [
      {
        "test": "in_water",
        "subject": "self",
        "operator": "==",
        "value": false
      },
      {
        "test": "on_ground",
        "subject": "self",
        "operator": "==",
        "value": true
      },
      {
        "test": "is_underground",
        "subject": "self",
        "operator": "==",
        "value": true
      },
      {
        "test": "weather_at_position",
        "subject": "self",
        "operator": "!=",
        "value": "thunderstorm"
      }
    ]
  },
  "wake_mob_exceptions": {
    "any_of": [
      {
        "test": "trusts",
        "subject": "other",
        "operator": "==",
        "value": true
      },
      {
        "test": "is_family",
        "subject": "other",
        "operator": "==",
        "value": "fox"
      },
      {
        "test": "is_sneaking",
        "subject": "other",
        "operator": "==",
        "value": true
      }
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Nap Behavior (minecraft:behavior.nap)
 * Allows mobs to occassionally stop and take a nap under certain
 * conditions.
 */
export default interface MinecraftBehaviorNap {

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: {"all_of":[{"test":"in_water","subject":"self","operator":"==","value":false},{"test":"on_ground","subject":"self","operator":"==","value":true},{"test":"is_underground","subject":"self","operator":"==","value":true},{"test":"weather_at_position","subject":"self","operator":"!=","value":"thunderstorm"}]}
   *
   */
  can_nap_filters?: MinecraftBehaviorNapCanNapFilters;

  /**
   * @remarks
   * Maximum time in seconds the mob has to wait before using the
   * goal again
   * 
   * Sample Values:
   * Fox: 7
   *
   */
  cooldown_max?: number;

  /**
   * @remarks
   * Minimum time in seconds the mob has to wait before using the
   * goal again
   * 
   * Sample Values:
   * Fox: 2
   *
   */
  cooldown_min?: number;

  /**
   * @remarks
   * The block distance in x and z that will be checked for mobs that
   * this mob detects
   * 
   * Sample Values:
   * Fox: 12
   *
   */
  mob_detect_dist?: number;

  /**
   * @remarks
   * The block distance in y that will be checked for mobs that this
   * mob detects
   * 
   * Sample Values:
   * Fox: 6
   *
   */
  mob_detect_height?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Fox: 8
   *
   */
  priority?: number;

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: {"any_of":[{"test":"trusts","subject":"other","operator":"==","value":true},{"test":"is_family","subject":"other","operator":"==","value":"fox"},{"test":"is_sneaking","subject":"other","operator":"==","value":true}]}
   *
   */
  wake_mob_exceptions?: MinecraftBehaviorNapWakeMobExceptions;

}


/**
 * Can nap filters (can_nap_filters)
 */
export interface MinecraftBehaviorNapCanNapFilters {

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: [{"test":"in_water","subject":"self","operator":"==","value":false},{"test":"on_ground","subject":"self","operator":"==","value":true},{"test":"is_underground","subject":"self","operator":"==","value":true},{"test":"weather_at_position","subject":"self","operator":"!=","value":"thunderstorm"}]
   *
   */
  all_of?: string;

}


/**
 * Wake mob exceptions (wake_mob_exceptions)
 */
export interface MinecraftBehaviorNapWakeMobExceptions {

  /**
   * @remarks
   * 
   * Sample Values:
   * Fox: [{"test":"trusts","subject":"other","operator":"==","value":true},{"test":"is_family","subject":"other","operator":"==","value":"fox"},{"test":"is_sneaking","subject":"other","operator":"==","value":true}]
   *
   */
  any_of?: string;

}