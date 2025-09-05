// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:angry
 * 
 * minecraft:angry Samples

Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:angry": {
  "duration": 25,
  "broadcastAnger": true,
  "broadcastRange": 20,
  "broadcast_anger_when_dying": false,
  "broadcast_filters": {
    "test": "is_family",
    "operator": "!=",
    "value": "pacified"
  },
  "calm_event": {
    "event": "calmed_down",
    "target": "self"
  }
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

"minecraft:angry": {
  "duration": 10,
  "duration_delta": 3,
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:angry": {
  "duration": 25,
  "broadcast_anger": true,
  "broadcast_range": 16,
  "calm_event": {
    "event": "on_calm",
    "target": "self"
  }
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:angry": {
  "duration": 25,
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:angry": {
  "duration": 10,
  "broadcast_anger": true,
  "broadcast_range": 16,
  "calm_event": {
    "event": "become_calm_event",
    "target": "self"
  },
  "angry_sound": "angry",
  "sound_interval": {
    "range_min": 2,
    "range_max": 5
  }
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

 * At /minecraft:entity/component_groups/minecraft:llama_angry/minecraft:angry/: 
"minecraft:angry": {
  "duration": 4,
  "broadcast_anger": false,
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/minecraft:llama_angry_wolf/minecraft:angry/: 
"minecraft:angry": {
  "duration": -1,
  "broadcast_anger": false,
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}


Panda - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/panda.json

 * At /minecraft:entity/component_groups/minecraft:panda_angry/minecraft:angry/: 
"minecraft:angry": {
  "duration": 500,
  "broadcast_anger": true,
  "broadcast_range": 41,
  "broadcast_filters": {
    "test": "is_family",
    "operator": "==",
    "value": "panda_aggressive"
  },
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/minecraft:baby_scared/minecraft:angry/: 
"minecraft:angry": {
  "duration": 1,
  "broadcast_anger": true,
  "broadcast_range": 41,
  "broadcast_filters": {
    "test": "is_family",
    "operator": "==",
    "value": "panda_aggressive"
  },
  "calm_event": {
    "event": "minecraft:baby_on_calm",
    "target": "self"
  }
}


Polar Bear - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/polar_bear.json

 * At /minecraft:entity/component_groups/minecraft:baby_scared/minecraft:angry/: 
"minecraft:angry": {
  "duration": 1,
  "broadcast_anger": true,
  "broadcast_range": 41,
  "calm_event": {
    "event": "minecraft:baby_on_calm",
    "target": "self"
  }
}

 * At /minecraft:entity/component_groups/minecraft:adult_hostile/minecraft:angry/: 
"minecraft:angry": {
  "duration": 500,
  "broadcast_anger": false,
  "broadcast_range": 20,
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}


Silverfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/silverfish.json

"minecraft:angry": {
  "duration": -1,
  "broadcast_anger": true,
  "broadcast_range": 20,
  "broadcast_anger_when_dying": false,
  "calm_event": {
    "event": "minecraft:on_calm",
    "target": "self"
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Angry (minecraft:angry)
 * Defines an entity's 'angry' state using a timer.
 */
export default interface MinecraftAngry {

  /**
   * @remarks
   * The sound event to play when the mob is angry
   * 
   * Sample Values:
   * Hoglin: "angry"
   *
   *
   */
  angry_sound?: string;

  /**
   * @remarks
   * If set, other entities of the same entity definition within the
   * broadcastRange will also become angry
   * 
   * Sample Values:
   * Dolphin: true
   *
   *
   */
  broadcast_anger?: boolean;

  /**
   * @remarks
   * If set, other entities of the same entity definition within the
   * broadcastRange will also become angry whenever this mob 
   * attacks
   */
  broadcast_anger_on_attack?: boolean;

  /**
   * @remarks
   * If true, other entities of the same entity definition within the
   * broadcastRange will also become angry whenever this mob is
   * attacked
   */
  broadcast_anger_on_being_attacked?: boolean;

  /**
   * @remarks
   * If false, when this mob is killed it does not spread its anger to
   * other entities of the same entity definition within the
   * broadcastRange
   */
  broadcast_anger_when_dying?: boolean;

  /**
   * @remarks
   * Conditions that make this entry in the list valid
   * 
   * Sample Values:
   * Bee: {"test":"is_family","operator":"!=","value":"pacified"}
   *
   * Panda: {"test":"is_family","operator":"==","value":"panda_aggressive"}
   *
   * Wandering Trader: {"test":"is_leashed_to","subject":"other","value":true}
   *
   */
  broadcast_filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Distance in blocks within which other entities of the same entity
   * type will become angry
   * 
   * Sample Values:
   * Dolphin: 16
   *
   *
   * Panda: 41
   *
   * Polar Bear: 20
   *
   */
  broadcast_range?: number;

  /**
   * @remarks
   * A list of entity families to broadcast anger to
   * 
   * Sample Values:
   * Wandering Trader: ["llama","trader_llama"]
   *
   */
  broadcast_targets?: string[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: true
   *
   *
   */
  broadcastAnger?: string;

  /**
   * @remarks
   * 
   * Sample Values:
   * Bee: 20
   *
   * Wandering Trader: 10
   *
   */
  broadcastRange?: number;

  /**
   * @remarks
   * Event to fire when this entity is calmed down
   * 
   * Sample Values:
   * Bee: {"event":"calmed_down","target":"self"}
   *
   * Cave Spider: {"event":"minecraft:on_calm","target":"self"}
   *
   * Dolphin: {"event":"on_calm","target":"self"}
   *
   */
  calm_event?: string;

  /**
   * @remarks
   * The amount of time in seconds that the entity will be angry.
   * 
   * Sample Values:
   * Bee: 25
   *
   * Cave Spider: 10
   *
   *
   *
   * Llama: 4, -1
   *
   */
  duration?: number;

  /**
   * @remarks
   * Variance in seconds added to the duration [-delta, delta].
   * 
   * Sample Values:
   * Cave Spider: 3
   *
   *
   */
  duration_delta?: number;

  /**
   * @remarks
   * Filter out mob types that it should not attack while angry (other
   * Piglins)
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The range of time in seconds to randomly wait before playing the
   * sound again.
   * 
   * Sample Values:
   * Hoglin: {"range_min":2,"range_max":5}
   *
   *
   */
  sound_interval?: number[];

}