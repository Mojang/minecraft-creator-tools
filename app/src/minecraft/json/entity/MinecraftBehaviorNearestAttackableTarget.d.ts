// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.nearest_attackable_target
 * 
 * minecraft:behavior.nearest_attackable_target Samples

Axolotl - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/axolotl.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 3,
  "must_see": true,
  "reselect_targets": true,
  "within_radius": 20,
  "must_see_forget_duration": 17,
  "entity_types": [
    {
      "filters": {
        "all_of": [
          {
            "test": "in_water",
            "subject": "other",
            "value": true
          },
          {
            "test": "has_component",
            "subject": "self",
            "operator": "!=",
            "value": "minecraft:attack_cooldown"
          },
          {
            "any_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "squid"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "fish"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "tadpole"
              }
            ]
          }
        ]
      },
      "max_dist": 8
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "in_water",
            "subject": "other",
            "value": true
          },
          {
            "any_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "drowned"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "guardian"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "guardian_elder"
              }
            ]
          }
        ]
      },
      "max_dist": 8
    }
  ]
}


Bee - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bee.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 10
    }
  ]
}


Blaze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/blaze.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "must_see": true,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 48
    }
  ]
}


Bogged - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/bogged.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "must_see": true,
  "reselect_targets": true,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 16
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      },
      "max_dist": 16
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "baby_turtle"
          },
          {
            "test": "in_water",
            "subject": "other",
            "operator": "!=",
            "value": true
          }
        ]
      },
      "max_dist": 16
    }
  ]
}


Breeze - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/breeze.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 1,
  "within_radius": 24,
  "scan_interval": 10,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 24
    },
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "irongolem"
      },
      "max_dist": 24
    }
  ],
  "must_see": true
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 1,
  "reselect_targets": true,
  "within_radius": 16,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "rabbit"
      },
      "max_dist": 8
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "baby_turtle"
          },
          {
            "test": "in_water",
            "subject": "other",
            "operator": "!=",
            "value": true
          }
        ]
      },
      "max_dist": 8
    }
  ]
}


Cave Spider - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cave_spider.json

 * At /minecraft:entity/component_groups/minecraft:spider_hostile/minecraft:behavior.nearest_attackable_target/: 
"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "must_see": true,
  "attack_interval": 5,
  "entity_types": [
    {
      "filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "snowgolem"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "irongolem"
          }
        ]
      },
      "max_dist": 16
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:spider_angry/minecraft:behavior.nearest_attackable_target/: 
"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "must_see": true,
  "attack_interval": 10,
  "entity_types": [
    {
      "filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "snowgolem"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "irongolem"
          }
        ]
      },
      "max_dist": 16
    }
  ]
}


Creeper - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/creeper.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 1,
  "must_see": true,
  "must_see_forget_duration": 3,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "player"
      },
      "max_dist": 16
    }
  ]
}


Drowned - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/drowned.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 2,
  "reselect_targets": true,
  "must_see": true,
  "within_radius": 12,
  "must_see_forget_duration": 17,
  "persist_time": 0.5,
  "entity_types": [
    {
      "filters": {
        "all_of": [
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
                "value": "snowgolem"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "irongolem"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "axolotl"
              }
            ]
          },
          {
            "any_of": [
              {
                "test": "in_water",
                "subject": "other",
                "value": true
              },
              {
                "test": "is_daytime",
                "value": false
              }
            ]
          }
        ]
      },
      "max_dist": 20
    },
    {
      "filters": {
        "all_of": [
          {
            "any_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "villager"
              },
              {
                "test": "is_family",
                "subject": "other",
                "value": "wandering_trader"
              }
            ]
          },
          {
            "any_of": [
              {
                "test": "in_water",
                "subject": "other",
                "value": true
              },
              {
                "test": "is_daytime",
                "value": false
              }
            ]
          }
        ]
      },
      "max_dist": 20,
      "must_see": false
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "baby_turtle"
          },
          {
            "test": "in_water",
            "subject": "other",
            "operator": "!=",
            "value": true
          }
        ]
      },
      "max_dist": 20
    }
  ]
}


Elder Guardian - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/elder_guardian.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 1,
  "entity_types": [
    {
      "filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "squid"
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "axolotl"
          }
        ]
      },
      "max_dist": 16
    }
  ],
  "attack_interval_min": 1,
  "must_see": true
}


Enderman - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/enderman.json

"minecraft:behavior.nearest_attackable_target": {
  "priority": 5,
  "must_see": true,
  "attack_interval": 10,
  "entity_types": [
    {
      "filters": {
        "test": "is_family",
        "subject": "other",
        "value": "endermite"
      },
      "max_dist": 64
    }
  ]
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Nearest Attackable Target Behavior
 * (minecraft:behavior.nearest_attackable_target)
 * Allows an entity to attack the closest target within a given
 * subset of specific target types.
 */
export default interface MinecraftBehaviorNearestAttackableTarget {

  /**
   * @remarks
   * Time range (in seconds) between searching for an attack target,
   * range is in (0, "attack_interval"]. Only used if
   * "attack_interval" is greater than 0, otherwise "scan_interval" is
   * used.
   * 
   * Sample Values:
   * Cave Spider: 5, 10
   *
   *
   * Llama: 16
   *
   */
  attack_interval?: number[];

  /**
   * @remarks
   * 
   * Sample Values:
   * Elder Guardian: 1
   *
   */
  attack_interval_min?: number;

  attack_intervalattack_interval_min?: string;

  /**
   * @remarks
   * If true, this entity can attack its owner.
   */
  attack_owner?: boolean;

  /**
   * @remarks
   * List of entity types that this mob considers valid targets
   * 
   * Sample Values:
   * Axolotl: [{"filters":{"all_of":[{"test":"in_water","subject":"other","value":true},{"test":"has_component","subject":"self","operator":"!=","value":"minecraft:attack_cooldown"},{"any_of":[{"test":"is_family","subject":"other","value":"squid"},{"test":"is_family","subject":"other","value":"fish"},{"test":"is_family","subject":"other","value":"tadpole"}]}]},"max_dist":8},{"filters":{"all_of":[{"test":"in_water","subject":"other","value":true},{"any_of":[{"test":"is_family","subject":"other","value":"drowned"},{"test":"is_family","subject":"other","value":"guardian"},{"test":"is_family","subject":"other","value":"guardian_elder"}]}]},"max_dist":8}]
   *
   * Bee: [{"filters":{"test":"is_family","subject":"other","value":"player"},"max_dist":10}]
   *
   * Blaze: [{"filters":{"test":"is_family","subject":"other","value":"player"},"max_dist":48}]
   *
   */
  entity_types?: MinecraftBehaviorNearestAttackableTargetEntityTypes[];

  /**
   * @remarks
   * If true, this entity requires a path to the target.
   * 
   * Sample Values:
   * Iron Golem: true
   *
   *
   */
  must_reach?: boolean;

  /**
   * @remarks
   * Determines if target-validity requires this entity to be in
   * range only, or both in range and in sight.
   * 
   * Sample Values:
   * Axolotl: true
   *
   *
   */
  must_see?: boolean;

  /**
   * @remarks
   * Time (in seconds) the target must not be seen by this entity to
   * become invalid. Used only if "must_see" is true.
   * 
   * Sample Values:
   * Axolotl: 17
   *
   * Creeper: 3
   *
   *
   * Phantom: 0.5
   *
   */
  must_see_forget_duration?: number;

  /**
   * @remarks
   * Time (in seconds) this entity can continue attacking the target
   * after the target is no longer valid.
   * 
   * Sample Values:
   * Drowned: 0.5
   *
   */
  persist_time?: number;

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Axolotl: 3
   *
   * Bee: 2
   *
   *
   * Breeze: 1
   *
   */
  priority?: number;

  /**
   * @remarks
   * Allows the attacking entity to update the nearest target, otherwise a
   * target is only reselected after each "scan_interval" or
   * "attack_interval".
   * 
   * Sample Values:
   * Axolotl: true
   *
   *
   */
  reselect_targets?: boolean;

  /**
   * @remarks
   * If "attack_interval" is 0 or isn't declared, then between attacks:
   * scanning for a new target occurs every amount of ticks equal to
   * "scan_interval", minimum value is 1. Values under 10 can affect
   * performance.
   * 
   * Sample Values:
   * Breeze: 10
   *
   * Phantom: 20
   *
   */
  scan_interval?: number;

  /**
   * @remarks
   * Allows the actor to be set to persist upon targeting a 
   * player
   */
  set_persistent?: boolean;

  /**
   * @remarks
   * Probability (0.0 to 1.0) that this entity will accept a found
   * target. Checked each time a valid target is found during 
   * scanning.
   * 
   * Sample Values:
   * Nautilus: 0.5
   *
   *
   */
  target_acquisition_probability?: number;

  /**
   * @remarks
   * Multiplied with the target's armor coverage percentage to
   * modify "max_dist" when detecting an invisible target.
   */
  target_invisible_multiplier?: number;

  /**
   * @remarks
   * Maximum vertical target-search distance, if it's greater than the
   * target type's "max_dist". A negative value defaults to
   * "entity_types" greatest "max_dist".
   * 
   * Sample Values:
   * Phantom: 80
   *
   */
  target_search_height?: number;

  /**
   * @remarks
   * Multiplied with the target type's "max_dist" when trying to
   * detect a sneaking target.
   */
  target_sneak_visibility_multiplier?: number;

  /**
   * @remarks
   * Maximum distance this entity can be from the target when
   * following it, otherwise the target becomes invalid. This value is
   * only used if the entity doesn't declare 
   * "minecraft:follow_range".
   * 
   * Sample Values:
   * Axolotl: 20
   *
   * Breeze: 24
   *
   * Cat: 16
   *
   */
  within_radius?: number;

}


/**
 * List of entity types that this mob considers valid targets.
 */
export interface MinecraftBehaviorNearestAttackableTargetEntityTypes {

  /**
   * @remarks
   * The amount of time in seconds that the mob has to wait before
   * selecting a target of the same type again
   */
  cooldown?: number;

  /**
   * @remarks
   * Conditions that make this entry in the list valid
   */
  filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Maximum distance this mob can be away to be a valid choice
   */
  max_dist?: number;

  /**
   * @remarks
   * If true, the mob has to be visible to be a valid choice
   */
  must_see?: boolean;

  /**
   * @remarks
   * Determines the amount of time in seconds that this mob will look
   * for a target before forgetting about it and looking for a new
   * one when the target isn't visible any more
   */
  must_see_forget_duration?: number;

  priority?: number;

  /**
   * @remarks
   * If true, the mob will stop being targeted if it stops meeting any
   * conditions.
   */
  reevaluate_description?: boolean;

  /**
   * @remarks
   * Multiplier for the running speed. A value of 1.0 means the speed
   * is unchanged
   */
  sprint_speed_multiplier?: number;

  /**
   * @remarks
   * Multiplier for the walking speed. A value of 1.0 means the speed
   * is unchanged
   */
  walk_speed_multiplier?: number;

}