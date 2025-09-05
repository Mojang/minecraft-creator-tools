// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.defend_village_target
 * 
 * minecraft:behavior.defend_village_target Samples

Iron Golem - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/iron_golem.json

"minecraft:behavior.defend_village_target": {
  "priority": 1,
  "must_reach": true,
  "attack_chance": 0.05,
  "entity_types": {
    "filters": {
      "any_of": [
        {
          "test": "is_family",
          "subject": "other",
          "value": "mob"
        },
        {
          "test": "is_family",
          "subject": "other",
          "value": "player"
        }
      ]
    }
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Defend Village Target Behavior
 * (minecraft:behavior.defend_village_target)
 * Allows the entity to stay in a village and defend the village from
 * aggressors. If a player is in bad standing with the village this
 * goal will cause the entity to attack the player regardless of
 * filter conditions.
 */
export default interface MinecraftBehaviorDefendVillageTarget {

  /**
   * @remarks
   * The percentage chance that the entity has to attack aggressors of
   * its village, where 1.0 = 100%.
   * 
   * Sample Values:
   * Iron Golem: 0.05
   *
   */
  attack_chance?: number;

  /**
   * @remarks
   * If true, this entity can attack its owner.
   */
  attack_owner?: boolean;

  /**
   * @remarks
   * Filters which types of targets are valid for this entity.
   * 
   * Sample Values:
   * Iron Golem: {"filters":{"any_of":[{"test":"is_family","subject":"other","value":"mob"},{"test":"is_family","subject":"other","value":"player"}]}}
   *
   */
  entity_types?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * If true, this entity requires a path to the target.
   * 
   * Sample Values:
   * Iron Golem: true
   *
   */
  must_reach?: boolean;

  /**
   * @remarks
   * Determines if target-validity requires this entity to be in
   * range only, or both in range and in sight.
   */
  must_see?: boolean;

  /**
   * @remarks
   * Time (in seconds) the target must not be seen by this entity to
   * become invalid. Used only if "must_see" is true.
   */
  must_see_forget_duration?: number;

  /**
   * @remarks
   * Time (in seconds) this entity can continue attacking the target
   * after the target is no longer valid.
   */
  persist_time?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Iron Golem: 1
   *
   */
  priority?: number;

  /**
   * @remarks
   * Maximum distance this entity can be from the target when
   * following it, otherwise the target becomes invalid. This value is
   * only used if the entity doesn't declare 
   * "minecraft:follow_range".
   */
  within_radius?: number;

}