// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:ambient_sound_interval
 * 
 * minecraft:ambient_sound_interval Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:ambient_sound_interval": {
  "value": 5,
  "range": 5,
  "event_name": "ambient",
  "event_names": [
    {
      "event_name": "ambient.tame",
      "condition": "query.is_using_item"
    },
    {
      "event_name": "ambient",
      "condition": "!query.is_using_item"
    }
  ]
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:ambient_sound_interval": {}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/look_for_food/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "ambient.pollinate",
  "range": 3,
  "value": 2
}

 * At /minecraft:entity/component_groups/default_sound/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "ambient",
  "range": 0,
  "value": 0
}


Creaking - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creaking.json

 * At /minecraft:entity/component_groups/minecraft:hostile/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "undefined"
}


Evocation Illager - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/evocation_illager.json

"minecraft:ambient_sound_interval": {
  "value": 2,
  "range": 4,
  "event_name": "ambient.in.raid"
}


Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

 * At /minecraft:entity/component_groups/minecraft:fox_ambient_normal/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "ambient"
}

 * At /minecraft:entity/component_groups/minecraft:fox_ambient_sleep/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "sleep"
}

 * At /minecraft:entity/component_groups/minecraft:fox_ambient_night/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "screech",
  "value": 80,
  "range": 160
}

 * At /minecraft:entity/component_groups/minecraft:fox_ambient_defending_target/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "event_name": "mad"
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

 * At /minecraft:entity/component_groups/minecraft:adult_with_passengers/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "value": 30
}

 * At /minecraft:entity/component_groups/minecraft:adult_without_passengers/minecraft:ambient_sound_interval/: 
"minecraft:ambient_sound_interval": {
  "value": 5
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Ambient Sound Interval (minecraft:ambient_sound_interval)
 * Delay for an entity playing its sound.
 */
export default interface MinecraftAmbientSoundInterval {

  /**
   * @remarks
   * Level sound event to be played as the ambient sound.
   * 
   * Sample Values:
   * Allay: "ambient"
   *
   * Bee: "ambient.pollinate"
   *
   * Creaking: "undefined"
   *
   */
  event_name: string;

  /**
   * @remarks
   * List of dynamic level sound events, with conditions for choosing
   * between them. Evaluated in order, first one wins. If none
   * evaluate to true, 'event_name' will take precedence.
   * 
   * Sample Values:
   * Allay: [{"event_name":"ambient.tame","condition":"query.is_using_item"},{"event_name":"ambient","condition":"!query.is_using_item"}]
   *
   * Warden: [{"event_name":"angry","condition":"query.anger_level(this) >= 80"},{"event_name":"agitated","condition":"query.anger_level(this) >= 40"}]
   *
   */
  event_names: MinecraftAmbientSoundIntervalEventNames[];

  /**
   * @remarks
   * Maximum time in seconds to randomly add to the ambient sound delay
   * time.
   * 
   * Sample Values:
   * Allay: 5
   *
   * Bee: 3
   *
   * Evocation Illager: 4
   *
   */
  range: number;

  /**
   * @remarks
   * Minimum time in seconds before the entity plays its ambient sound
   * again.
   * 
   * Sample Values:
   * Allay: 5
   *
   * Bee: 2
   *
   *
   * Fox: 80
   *
   */
  value: number;

}


/**
 * List of dynamic level sound events, with conditions for choosing
 * between them. Evaluated in order, first one wins. If none
 * evaluate to true, 'event_name' will take precedence.
 */
export interface MinecraftAmbientSoundIntervalEventNames {

  /**
   * @remarks
   * The condition that must be satisfied to select the given ambient
   * sound
   */
  condition: string;

  /**
   * @remarks
   * Level sound event to be played as the ambient sound
   */
  event_name: string;

}