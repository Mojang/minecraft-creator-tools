// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.teleport_to_owner
 * 
 * minecraft:behavior.teleport_to_owner Samples

Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.teleport_to_owner": {
  "priority": 0,
  "filters": {
    "all_of": [
      {
        "test": "owner_distance",
        "operator": ">",
        "value": 12
      },
      {
        "test": "is_panicking"
      }
    ]
  }
}


Wolf - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/wolf.json

"minecraft:behavior.teleport_to_owner": {
  "priority": 1,
  "filters": {
    "any_of": [
      {
        "all_of": [
          {
            "test": "owner_distance",
            "operator": ">",
            "value": 12
          },
          {
            "test": "is_panicking"
          }
        ]
      },
      {
        "all_of": [
          {
            "test": "owner_distance",
            "operator": ">",
            "value": 24
          },
          {
            "test": "has_target"
          }
        ]
      }
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Teleport To Owner Behavior 
 * (minecraft:behavior.teleport_to_owner)
 * Allows an entity to teleport to its owner.
 */
export default interface MinecraftBehaviorTeleportToOwner {

  /**
   * @remarks
   * The time in seconds that must pass for the entity to be able to
   * try to teleport again.
   */
  cooldown?: number;

  /**
   * @remarks
   * Conditions to be satisfied for the entity to teleport to its
   * owner.
   * 
   * Sample Values:
   * Cat: {"all_of":[{"test":"owner_distance","operator":">","value":12},{"test":"is_panicking"}]}
   *
   *
   * Wolf: {"any_of":[{"all_of":[{"test":"owner_distance","operator":">","value":12},{"test":"is_panicking"}]},{"all_of":[{"test":"owner_distance","operator":">","value":24},{"test":"has_target"}]}]}
   *
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Wolf: 1
   *
   */
  priority?: number;

}