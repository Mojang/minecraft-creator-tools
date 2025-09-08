// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:entity_sensor
 * 
 * minecraft:entity_sensor Samples

Armadillo - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/armadillo.json

"minecraft:entity_sensor": {
  "subsensors": [
    {
      "event": "minecraft:no_threat_detected",
      "cooldown": 0.2,
      "range": [
        7,
        2
      ],
      "minimum_count": 0,
      "maximum_count": 0,
      "event_filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "undead"
          },
          {
            "all_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "player"
              },
              {
                "any_of": [
                  {
                    "test": "was_last_hurt_by",
                    "subject": "other"
                  },
                  {
                    "test": "is_sprinting",
                    "subject": "other"
                  },
                  {
                    "test": "is_riding",
                    "subject": "other"
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    {
      "event": "minecraft:threat_detected",
      "cooldown": 0.2,
      "range": [
        7,
        2
      ],
      "minimum_count": 1,
      "event_filters": {
        "any_of": [
          {
            "test": "is_family",
            "subject": "other",
            "value": "undead"
          },
          {
            "all_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "player"
              },
              {
                "any_of": [
                  {
                    "test": "was_last_hurt_by",
                    "subject": "other"
                  },
                  {
                    "test": "is_sprinting",
                    "subject": "other"
                  },
                  {
                    "test": "is_riding",
                    "subject": "other"
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:entity_sensor": {
  "find_players_only": true,
  "relative_range": false,
  "subsensors": [
    {
      "event": "minecraft:become_mobile",
      "cooldown": 0,
      "y_offset": 4.5,
      "range": [
        3.5,
        2
      ],
      "minimum_count": 0,
      "maximum_count": 0,
      "event_filters": {
        "all_of": [
          {
            "test": "is_vehicle_family",
            "subject": "other",
            "operator": "not",
            "value": "happy_ghast"
          },
          {
            "test": "actor_health",
            "operator": ">",
            "value": 0
          }
        ]
      }
    },
    {
      "event": "minecraft:become_immobile",
      "cooldown": 0,
      "y_offset": 4.5,
      "range": [
        3,
        1.5
      ],
      "minimum_count": 1,
      "event_filters": {
        "all_of": [
          {
            "test": "is_vehicle_family",
            "subject": "other",
            "operator": "not",
            "value": "happy_ghast"
          },
          {
            "test": "actor_health",
            "operator": ">",
            "value": 0
          }
        ]
      }
    }
  ]
}


Parrot - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/parrot.json

 * At /minecraft:entity/component_groups/minecraft:parrot_not_riding_player/minecraft:entity_sensor/: 
"minecraft:entity_sensor": {
  "relative_range": false,
  "subsensors": [
    {
      "range": [
        2,
        2
      ],
      "event_filters": {
        "all_of": [
          {
            "test": "is_riding",
            "subject": "self",
            "operator": "equals",
            "value": true
          },
          {
            "test": "has_component",
            "subject": "self",
            "operator": "equals",
            "value": "minecraft:behavior.look_at_player"
          }
        ]
      },
      "event": "minecraft:on_riding_player"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:parrot_riding_player/minecraft:entity_sensor/: 
"minecraft:entity_sensor": {
  "relative_range": false,
  "subsensors": [
    {
      "range": [
        2,
        2
      ],
      "event_filters": {
        "all_of": [
          {
            "test": "is_riding",
            "subject": "self",
            "operator": "equals",
            "value": false
          },
          {
            "test": "has_component",
            "subject": "self",
            "operator": "not",
            "value": "minecraft:behavior.look_at_player"
          }
        ]
      },
      "event": "minecraft:on_not_riding_player"
    }
  ]
}


Pufferfish - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/pufferfish.json

 * At /minecraft:entity/component_groups/minecraft:normal_puff/minecraft:entity_sensor/: 
"minecraft:entity_sensor": {
  "relative_range": false,
  "subsensors": [
    {
      "range": [
        2.5,
        2.5
      ],
      "minimum_count": 1,
      "event_filters": {
        "any_of": [
          {
            "all_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "mob"
              },
              {
                "any_of": [
                  {
                    "test": "is_family",
                    "subject": "other",
                    "value": "axolotl"
                  },
                  {
                    "test": "is_family",
                    "subject": "other",
                    "operator": "not",
                    "value": "aquatic"
                  }
                ]
              }
            ]
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          }
        ]
      },
      "event": "minecraft:start_half_puff"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:half_puff_secondary/minecraft:entity_sensor/: 
"minecraft:entity_sensor": {
  "relative_range": false,
  "subsensors": [
    {
      "range": [
        2.5,
        2.5
      ],
      "minimum_count": 1,
      "event_filters": {
        "any_of": [
          {
            "all_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "mob"
              },
              {
                "any_of": [
                  {
                    "test": "is_family",
                    "subject": "other",
                    "value": "axolotl"
                  },
                  {
                    "test": "is_family",
                    "subject": "other",
                    "operator": "not",
                    "value": "aquatic"
                  }
                ]
              }
            ]
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          }
        ]
      },
      "event": "minecraft:start_full_puff"
    }
  ]
}

 * At /minecraft:entity/component_groups/minecraft:deflate_sensor/minecraft:entity_sensor/: 
"minecraft:entity_sensor": {
  "relative_range": false,
  "subsensors": [
    {
      "range": [
        2.9,
        2.9
      ],
      "minimum_count": 0,
      "maximum_count": 0,
      "event_filters": {
        "any_of": [
          {
            "all_of": [
              {
                "test": "is_family",
                "subject": "other",
                "value": "mob"
              },
              {
                "any_of": [
                  {
                    "test": "is_family",
                    "subject": "other",
                    "value": "axolotl"
                  },
                  {
                    "test": "is_family",
                    "subject": "other",
                    "operator": "not",
                    "value": "aquatic"
                  }
                ]
              }
            ]
          },
          {
            "test": "is_family",
            "subject": "other",
            "value": "player"
          }
        ]
      },
      "event": "minecraft:from_full_puff"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Entity Sensor (minecraft:entity_sensor)
 * A component that owns multiple subsensors, each one firing an
 * event when a set of conditions are met by other entities within the
 * defined range.
 */
export default interface MinecraftEntitySensor {

  /**
   * @remarks
   * Limits the search to Players only for all subsensors.
   * 
   * Sample Values:
   * Happy Ghast: true
   *
   */
  find_players_only?: boolean;

  /**
   * @remarks
   * If true the subsensors' range is additive on top of the entity's
   * size.
   */
  relative_range?: boolean;

  /**
   * @remarks
   * The list of subsensors which sense for entities and emit events
   * when all their conditions are met.
   * 
   * Sample Values:
   * Armadillo: [{"event":"minecraft:no_threat_detected","cooldown":0.2,"range":[7,2],"minimum_count":0,"maximum_count":0,"event_filters":{"any_of":[{"test":"is_family","subject":"other","value":"undead"},{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"any_of":[{"test":"was_last_hurt_by","subject":"other"},{"test":"is_sprinting","subject":"other"},{"test":"is_riding","subject":"other"}]}]}]}},{"event":"minecraft:threat_detected","cooldown":0.2,"range":[7,2],"minimum_count":1,"event_filters":{"any_of":[{"test":"is_family","subject":"other","value":"undead"},{"all_of":[{"test":"is_family","subject":"other","value":"player"},{"any_of":[{"test":"was_last_hurt_by","subject":"other"},{"test":"is_sprinting","subject":"other"},{"test":"is_riding","subject":"other"}]}]}]}}]
   *
   */
  subsensors?: MinecraftEntitySensorSubsensors[];

}


/**
 * The list of subsensors which sense for entities and emit events
 * when all their conditions are met.
 */
export interface MinecraftEntitySensorSubsensors {

  /**
   * @remarks
   * How many seconds should elapse before the subsensor can once
   * again sense for entities. The cooldown is applied on top of the
   * base 1 tick (0.05 seconds) delay. Negative values will result in
   * no cooldown being used.
   */
  cooldown?: number;

  /**
   * @remarks
   * Event to fire when the conditions are met.
   */
  event?: jsoncommon.MinecraftEventTrigger;

  /**
   * @remarks
   * The set of conditions that must be satisfied to fire the 
   * event.
   */
  event_filters?: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * The maximum number of entities that must pass the filter conditions for
   * the event to send.
   */
  maximum_count?: number;

  /**
   * @remarks
   * The minimum number of entities that must pass the filter conditions for
   * the event to send.
   */
  minimum_count?: number;

  /**
   * @remarks
   * The maximum horizontal and vertical distance another entity can
   * be from this and have the filters checked against it.
   */
  range?: number[];

  /**
   * @remarks
   * If true requires all nearby entities to pass the filter conditions for
   * the events to send.
   */
  require_all?: boolean;

  /**
   * @remarks
   * Vertical offset applied to the entity's position when computing the
   * distance from other entities.
   */
  y_offset?: number;

}