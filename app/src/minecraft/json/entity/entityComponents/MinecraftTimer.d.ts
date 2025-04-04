// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:timer
 * 
 * minecraft:timer Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:timer": {
  "looping": false,
  "time": 3,
  "time_down_event": {
    "event": "pickup_item_delay_complete"
  }
}


Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:timer": {
  "looping": true,
  "time": 4,
  "randomInterval": false,
  "time_down_event": {
    "event": "minecraft:unroll"
  }
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

 * At /minecraft:entity/component_groups/escape_fire/minecraft:timer/: 
"minecraft:timer": {
  "looping": false,
  "time": [
    20,
    50
  ],
  "randomInterval": true,
  "time_down_event": {
    "event": "stop_panicking_after_fire",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/countdown_to_perish/minecraft:timer/: 
"minecraft:timer": {
  "looping": false,
  "time": [
    10,
    60
  ],
  "randomInterval": true,
  "time_down_event": {
    "event": "perish_event",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/take_nearest_target/minecraft:timer/: 
"minecraft:timer": {
  "looping": true,
  "time": 5,
  "time_down_event": {
    "event": "calmed_down",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/look_for_food/minecraft:timer/: 
"minecraft:timer": {
  "looping": true,
  "time": 180,
  "time_down_event": {
    "event": "find_flower_timeout"
  }
}

 * At /minecraft:entity/component_groups/find_hive/minecraft:timer/: 
"minecraft:timer": {
  "looping": false,
  "time": 180,
  "time_down_event": {
    "event": "find_hive_timeout",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/hive_full/minecraft:timer/: 
"minecraft:timer": {
  "looping": false,
  "time": [
    5,
    20
  ],
  "randomInterval": true,
  "time_down_event": {
    "event": "find_hive_event",
    "target": "self"
  }
}


Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:timer": {
  "looping": false,
  "time": 3,
  "time_down_event": {
    "event": "minecraft:sink",
    "target": "self"
  }
}


Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/guardian.json

"minecraft:timer": {
  "time": [
    1,
    3
  ],
  "looping": false,
  "time_down_event": {
    "event": "minecraft:target_far_enough",
    "target": "self"
  }
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:timer": {
  "looping": false,
  "time": 15,
  "time_down_event": {
    "event": "become_zombie_event"
  }
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

"minecraft:timer": {
  "looping": false,
  "time": 30,
  "time_down_event": {
    "event": "minecraft:convert_to_zombie"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Timer (minecraft:timer)
 * Adds a timer after which an event will fire.
 */
export default interface MinecraftTimer {

  /**
   * @remarks
   * If true, the timer will restart every time after it fires.
   * 
   * Sample Values:
   * Armadillo: true
   *
   *
   */
  looping: boolean;

  /**
   * @remarks
   * This is a list of objects, representing one value in seconds that
   * can be picked before firing the event and an optional weight.
   * Incompatible with time.
   * 
   * Sample Values:
   * Wandering Trader: [{"weight":50,"value":2400},{"weight":50,"value":3600}]
   *
   */
  random_time_choices: string[];

  /**
   * @remarks
   * If true, the amount of time on the timer will be random between the
   * min and max values specified in time.
   * 
   * Sample Values:
   * Bee: true
   *
   */
  randomInterval: boolean;

  /**
   * @remarks
   * Amount of time in seconds for the timer. Can be specified as a
   * number or a pair of numbers (min and max). Incompatible with
   * random_time_choices.
   * 
   * Sample Values:
   * Allay: 3
   *
   * Armadillo: 4
   *
   * Bee: [20,50], [10,60], 5, 180, [5,20]
   *
   */
  time: number[];

  /**
   * @remarks
   * Event to fire when the time on the timer runs out.
   * 
   * Sample Values:
   * Allay: {"event":"pickup_item_delay_complete"}
   *
   * Armadillo: {"event":"minecraft:unroll"}
   *
   * Bee: {"event":"stop_panicking_after_fire","target":"self"}, {"event":"perish_event","target":"self"}, {"event":"calmed_down","target":"self"}, {"event":"find_flower_timeout"}, {"event":"find_hive_timeout","target":"self"}, {"event":"find_hive_event","target":"self"}
   *
   */
  time_down_event: jsoncommon.MinecraftEventTrigger;

}