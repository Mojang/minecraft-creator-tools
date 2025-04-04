// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:celebrate_hunt
 * 
 * minecraft:celebrate_hunt Samples

Piglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/piglin.json

"minecraft:celebrate_hunt": {
  "celebration_targets": {
    "all_of": [
      {
        "test": "is_family",
        "value": "hoglin"
      }
    ]
  },
  "broadcast": true,
  "duration": 10,
  "celebrate_sound": "celebrate",
  "sound_interval": {
    "range_min": 2,
    "range_max": 5
  },
  "radius": 16
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Celebrate Hunt (minecraft:celebrate_hunt)
 * Specifies hunt celebration behaviour.
 */
export default interface MinecraftCelebrateHunt {

  /**
   * @remarks
   * If true, celebration will be broadcasted to other entities in
   * the radius.
   * 
   * Sample Values:
   * Piglin: true
   *
   */
  broadcast: boolean;

  /**
   * @remarks
   * The list of conditions that target of hunt must satisfy to
   * initiate celebration.
   */
  celeberation_targets: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The sound event to play when the mob is celebrating
   * 
   * Sample Values:
   * Piglin: "celebrate"
   *
   */
  celebrate_sound: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Piglin: {"all_of":[{"test":"is_family","value":"hoglin"}]}
   *
   */
  celebration_targets: MinecraftCelebrateHuntCelebrationTargets;

  /**
   * @remarks
   * Duration, in seconds, of celebration
   * 
   * Sample Values:
   * Piglin: 10
   *
   */
  duration: number;

  /**
   * @remarks
   * If broadcast is enabled, specifies the radius in which it will
   * notify other entities for celebration.
   * 
   * Sample Values:
   * Piglin: 16
   *
   */
  radius: number;

  /**
   * @remarks
   * The range of time in seconds to randomly wait before playing the
   * sound again
   * 
   * Sample Values:
   * Piglin: {"range_min":2,"range_max":5}
   *
   */
  sound_interval: number[];

}


/**
 * Celebration_targets (celebration_targets)
 */
export interface MinecraftCelebrateHuntCelebrationTargets {

  /**
   * @remarks
   * 
   * Sample Values:
   * Piglin: [{"test":"is_family","value":"hoglin"}]
   *
   */
  all_of: string;

}