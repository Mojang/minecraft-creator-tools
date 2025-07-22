// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:scheduler
 * 
 * minecraft:scheduler Samples

Fox - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/fox.json

"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 0,
  "scheduled_events": [
    {
      "filters": [
        {
          "test": "is_sleeping",
          "value": true
        }
      ],
      "event": "minecraft:ambient_sleep"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_daytime",
            "value": false
          },
          {
            "test": "distance_to_nearest_player",
            "operator": ">",
            "value": 16
          }
        ]
      },
      "event": "minecraft:ambient_night"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "is_sleeping",
            "value": false
          },
          {
            "any_of": [
              {
                "test": "is_daytime",
                "value": true
              },
              {
                "test": "distance_to_nearest_player",
                "operator": "<=",
                "value": 16
              }
            ]
          }
        ]
      },
      "event": "minecraft:ambient_normal"
    }
  ]
}


Villager v2 - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/villager_v2.json

 * At /minecraft:entity/component_groups/work_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 8000
          }
        ]
      },
      "event": "minecraft:schedule_work_pro_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 8000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 10000
          }
        ]
      },
      "event": "minecraft:schedule_gather_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 10000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 11000
          }
        ]
      },
      "event": "minecraft:schedule_work_pro_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 11000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 12000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 12000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 * At /minecraft:entity/component_groups/basic_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 8000
          }
        ]
      },
      "event": "minecraft:schedule_wander_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 8000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 10000
          }
        ]
      },
      "event": "minecraft:schedule_gather_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 10000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 11000
          }
        ]
      },
      "event": "minecraft:schedule_wander_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 11000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 12000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 12000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 * At /minecraft:entity/component_groups/child_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 11000
          }
        ]
      },
      "event": "minecraft:schedule_play_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 11000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 12000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 12000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 * At /minecraft:entity/component_groups/jobless_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 2000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 13000
          }
        ]
      },
      "event": "minecraft:schedule_wander_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 13000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 14000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 14000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 2000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 * At /minecraft:entity/component_groups/fisher_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 8000
          }
        ]
      },
      "event": "minecraft:schedule_work_fisher"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 8000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 10000
          }
        ]
      },
      "event": "minecraft:schedule_gather_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 10000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 11000
          }
        ]
      },
      "event": "minecraft:schedule_work_fisher"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 11000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 12000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 12000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 * At /minecraft:entity/component_groups/librarian_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 8000
          }
        ]
      },
      "event": "minecraft:schedule_work_librarian"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 8000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 10000
          }
        ]
      },
      "event": "minecraft:schedule_gather_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 10000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 11000
          }
        ]
      },
      "event": "minecraft:schedule_work_librarian"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 11000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 12000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 12000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 * At /minecraft:entity/component_groups/farmer_schedule/minecraft:scheduler/: 
"minecraft:scheduler": {
  "min_delay_secs": 0,
  "max_delay_secs": 10,
  "scheduled_events": [
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 0
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 8000
          }
        ]
      },
      "event": "minecraft:schedule_work_farmer"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 8000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 10000
          }
        ]
      },
      "event": "minecraft:schedule_gather_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 10000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 11000
          }
        ]
      },
      "event": "minecraft:schedule_work_farmer"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 11000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 12000
          }
        ]
      },
      "event": "minecraft:schedule_home_villager"
    },
    {
      "filters": {
        "all_of": [
          {
            "test": "hourly_clock_time",
            "operator": ">=",
            "value": 12000
          },
          {
            "test": "hourly_clock_time",
            "operator": "<",
            "value": 24000
          }
        ]
      },
      "event": "minecraft:schedule_bed_villager"
    }
  ]
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Scheduler (minecraft:scheduler)
 * Fires off scheduled mob events at time of day events.
 */
export default interface MinecraftScheduler {

  /**
   * @remarks
   * 
   * Sample Values:
   * Villager v2: 10
   *
   */
  max_delay_secs: number;

  min_delay_secs: number;

  /**
   * @remarks
   * The list of triggers that fire when the conditions match the
   * given filter criteria. If any filter criteria overlap the first
   * defined event will be picked.
   * 
   * Sample Values:
   * Fox: [{"filters":[{"test":"is_sleeping","value":true}],"event":"minecraft:ambient_sleep"},{"filters":{"all_of":[{"test":"is_daytime","value":false},{"test":"distance_to_nearest_player","operator":">","value":16}]},"event":"minecraft:ambient_night"},{"filters":{"all_of":[{"test":"is_sleeping","value":false},{"any_of":[{"test":"is_daytime","value":true},{"test":"distance_to_nearest_player","operator":"<=","value":16}]}]},"event":"minecraft:ambient_normal"}]
   *
   * Villager v2: [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":8000}]},"event":"minecraft:schedule_work_pro_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":8000},{"test":"hourly_clock_time","operator":"<","value":10000}]},"event":"minecraft:schedule_gather_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":10000},{"test":"hourly_clock_time","operator":"<","value":11000}]},"event":"minecraft:schedule_work_pro_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":11000},{"test":"hourly_clock_time","operator":"<","value":12000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":12000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"}], [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":8000}]},"event":"minecraft:schedule_wander_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":8000},{"test":"hourly_clock_time","operator":"<","value":10000}]},"event":"minecraft:schedule_gather_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":10000},{"test":"hourly_clock_time","operator":"<","value":11000}]},"event":"minecraft:schedule_wander_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":11000},{"test":"hourly_clock_time","operator":"<","value":12000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":12000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"}], [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":11000}]},"event":"minecraft:schedule_play_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":11000},{"test":"hourly_clock_time","operator":"<","value":12000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":12000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"}], [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":2000},{"test":"hourly_clock_time","operator":"<","value":13000}]},"event":"minecraft:schedule_wander_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":13000},{"test":"hourly_clock_time","operator":"<","value":14000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":14000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":2000}]},"event":"minecraft:schedule_bed_villager"}], [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":8000}]},"event":"minecraft:schedule_work_fisher"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":8000},{"test":"hourly_clock_time","operator":"<","value":10000}]},"event":"minecraft:schedule_gather_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":10000},{"test":"hourly_clock_time","operator":"<","value":11000}]},"event":"minecraft:schedule_work_fisher"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":11000},{"test":"hourly_clock_time","operator":"<","value":12000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":12000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"}], [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":8000}]},"event":"minecraft:schedule_work_librarian"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":8000},{"test":"hourly_clock_time","operator":"<","value":10000}]},"event":"minecraft:schedule_gather_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":10000},{"test":"hourly_clock_time","operator":"<","value":11000}]},"event":"minecraft:schedule_work_librarian"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":11000},{"test":"hourly_clock_time","operator":"<","value":12000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":12000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"}], [{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":0},{"test":"hourly_clock_time","operator":"<","value":8000}]},"event":"minecraft:schedule_work_farmer"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":8000},{"test":"hourly_clock_time","operator":"<","value":10000}]},"event":"minecraft:schedule_gather_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":10000},{"test":"hourly_clock_time","operator":"<","value":11000}]},"event":"minecraft:schedule_work_farmer"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":11000},{"test":"hourly_clock_time","operator":"<","value":12000}]},"event":"minecraft:schedule_home_villager"},{"filters":{"all_of":[{"test":"hourly_clock_time","operator":">=","value":12000},{"test":"hourly_clock_time","operator":"<","value":24000}]},"event":"minecraft:schedule_bed_villager"}]
   *
   */
  scheduled_events: jsoncommon.MinecraftEventTrigger[];

}