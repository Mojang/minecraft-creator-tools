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

Biceson - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/biceson.behavior.json

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


Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

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

 * At /minecraft:entity/component_groups/minecraft:llama_defend_trader/minecraft:angry/: 
"minecraft:angry": {
  "duration": 10,
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
   */
  angry_sound?: string;

  /**
   * @remarks
   * If set, other entities of the same entity definition within the
   * broadcastRange will also become angry
   * 
   * Sample Values:
   * Biceson: true
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
   */
  broadcast_filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Distance in blocks within which other entities of the same entity
   * type will become angry
   * 
   * Sample Values:
   * Biceson: 41, 20
   *
   *
   */
  broadcast_range?: number;

  /**
   * @remarks
   * A list of entity families to broadcast anger to
   */
  broadcast_targets?: string[];

  /**
   * @remarks
   * Event to fire when this entity is calmed down
   * 
   * Sample Values:
   * Biceson: {"event":"minecraft:baby_on_calm","target":"self"}, {"event":"minecraft:on_calm","target":"self"}
   *
   *
   *
   */
  calm_event?: string;

  /**
   * @remarks
   * The amount of time in seconds that the entity will be angry.
   * 
   * Sample Values:
   * Biceson: 1, 500
   *
   * Frost Moose: 4, -1, 10
   *
   */
  duration?: number;

  /**
   * @remarks
   * Variance in seconds added to the duration [-delta, delta].
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
   */
  sound_interval?: number[];

}