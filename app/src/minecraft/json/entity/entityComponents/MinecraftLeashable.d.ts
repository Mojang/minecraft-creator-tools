// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:leashable
 * 
 * minecraft:leashable Samples

Allay - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/allay.json

"minecraft:leashable": {}


Boat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/boat.json

"minecraft:leashable": {
  "presets": [
    {
      "filter": {
        "test": "is_family",
        "subject": "other",
        "value": "happy_ghast"
      },
      "spring_type": "quad_dampened",
      "rotation_adjustment": 90
    },
    {
      "rotation_adjustment": 90,
      "soft_distance": 2,
      "hard_distance": 4
    }
  ]
}


Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:leashable": {
  "presets": [
    {
      "filter": {
        "test": "is_family",
        "subject": "other",
        "value": "happy_ghast"
      },
      "spring_type": "quad_dampened"
    }
  ]
}


Dolphin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/dolphin.json

"minecraft:leashable": {
  "presets": [
    {
      "soft_distance": 4,
      "hard_distance": 6,
      "max_distance": 10
    }
  ]
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:leashable": {
  "on_unleash": {
    "event": "minecraft:on_unleashed",
    "target": "self"
  },
  "presets": [
    {
      "hard_distance": 10,
      "max_distance": 14
    }
  ]
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

"minecraft:leashable": {
  "on_leash": {
    "event": "minecraft:on_leash",
    "target": "self"
  },
  "on_unleash": {
    "event": "minecraft:on_unleash",
    "target": "self"
  }
}


Zombie Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/zombie_horse.json

"minecraft:leashable": {
  "on_unleash": {
    "event": "minecraft:on_unleashed",
    "target": "self"
  },
  "presets": [
    {
      "filter": {
        "test": "is_family",
        "subject": "other",
        "value": "happy_ghast"
      },
      "spring_type": "quad_dampened"
    },
    {
      "hard_distance": 10,
      "max_distance": 14
    }
  ]
}


Sheepomelon - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/1_hello_world/behavior_packs/aop_mobs/entities/sheepomelon.behavior.json

"minecraft:leashable": {
  "soft_distance": 4,
  "hard_distance": 6,
  "max_distance": 10
}


Frost Moose - https://github.com/microsoft/minecraft-samples/tree/main/addon_starter/2_entities/behavior_packs/aop_mobs/entities/frost_moose.behavior.json

"minecraft:leashable": {
  "soft_distance": 4,
  "hard_distance": 6,
  "max_distance": 10,
  "can_be_stolen": true
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Leashable (minecraft:leashable)
 * Describes how this mob can be leashed to other items.
 */
export default interface MinecraftLeashable {

  /**
   * @remarks
   * If true, players can cut both incoming and outgoing leashes by
   * using shears on the entity.
   */
  can_be_cut?: boolean;

  /**
   * @remarks
   * If true, players can leash this entity even if it is already leashed
   * to another entity.
   * 
   * Sample Values:
   * Frost Moose: true
   *
   *
   */
  can_be_stolen?: boolean;

  /**
   * @remarks
   * Distance in blocks at which the leash stiffens, restricting 
   * movement.
   */
  hard_distance?: number;

  /**
   * @remarks
   * Distance in blocks it which the leash breaks.
   */
  max_distance?: number;

  /**
   * @remarks
   * Event to call when this entity is leashed.
   * 
   * Sample Values:
   * Llama: {"event":"minecraft:on_leash","target":"self"}
   *
   *
   */
  on_leash?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * Event to call when this entity is unleashed.
   * 
   * Sample Values:
   * Happy Ghast: {"event":"minecraft:on_unleashed","target":"self"}
   *
   * Llama: {"event":"minecraft:on_unleash","target":"self"}
   *
   *
   *
   */
  on_unleash?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * When set to true, "on_unleash" does not trigger when the entity
   * gets unleashed for reasons other than the player directly interacting
   * with it.
   */
  on_unleash_interact_only?: boolean;

  /**
   * @remarks
   * Defines how this entity behaves when leashed to another entity. The
   * first preset which "filter" conditions are met will be applied; if
   * none match, a default configuration is used instead.
   * 
   * Sample Values:
   * Boat: [{"filter":{"test":"is_family","subject":"other","value":"happy_ghast"},"spring_type":"quad_dampened","rotation_adjustment":90},{"rotation_adjustment":90,"soft_distance":2,"hard_distance":4}]
   *
   */
  presets?: MinecraftLeashablePresets[];

  /**
   * @remarks
   * Distance in blocks at which the 'spring' effect starts acting to
   * keep this entity close to the entity that leashed it.
   */
  soft_distance?: number;

}


/**
 * Defines how this entity behaves when leashed to another entity. The
 * first preset which "filter" conditions are met will be applied; if
 * none match, a default configuration is used instead.
 */
export interface MinecraftLeashablePresets {

  /**
   * @remarks
   * Conditions that must be met for this preset to be applied.
   */
  filter?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Distance (in blocks) over which the entity starts being pulled
   * towards the leash holder with a spring-like force. Entities can
   * enter and stay in vehicles if the leash is stretched under this
   * distance, but will dismount once it exceeds it.
   */
  hard_distance?: number;

  /**
   * @remarks
   * Distance in blocks at which the leash breaks.
   */
  max_distance?: number;

  /**
   * @remarks
   * Adjusts the rotation at which the entity reaches equilibrium, when
   * "spring_type" is set to "dampened" or "quad_dampened".
   */
  rotation_adjustment?: number;

  /**
   * @remarks
   * Distance (in blocks) over which the entity starts pathfinding toward
   * the leash holder, if able.
   */
  soft_distance?: number;

  /**
   * @remarks
   * Defines the type of spring-like force that pulls the entity towards
   * its leash holder:
- "bouncy": Simulates a highly elastic spring
   * that never reaches an equilibrium if the leashed entity is
   * suspended mid-air.
- "dampened": Simulates a dampened spring
   * attached to the front of the leashed entity's collision. It
   * reaches an equilibrium if the entity is suspended mid-air and
   * aligns with the movement direction.
- "quad_dampened": Simulates four
   * dampened springs connected to the center of each side of the
   * entities' collisions. It reaches an equilibrium if the entity is
   * suspended mid-air and gradually aligns with the leash holder over
   * time.
   */
  spring_type?: string;

}