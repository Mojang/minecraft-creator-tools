// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:rideable
 * 
 * minecraft:rideable Samples

Camel - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/camel.json

"minecraft:rideable": {
  "seat_count": 2,
  "crouching_skip_interact": true,
  "pull_in_entities": true,
  "family_types": [
    "player"
  ],
  "interact_text": "action.interact.ride.horse",
  "seats": [
    {
      "min_rider_count": 0,
      "max_rider_count": 2,
      "position": [
        0,
        1.905,
        0.5
      ]
    },
    {
      "min_rider_count": 1,
      "max_rider_count": 2,
      "position": [
        0,
        1.905,
        -0.5
      ]
    }
  ]
}


Cat - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cat.json

"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "zombie"
  ],
  "seats": {
    "position": [
      0,
      0.35,
      0
    ]
  }
}


Chicken - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/chicken.json

"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "zombie"
  ],
  "seats": {
    "position": [
      0,
      0.4,
      0
    ]
  }
}


Cow - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/cow.json

"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "zombie"
  ],
  "seats": {
    "position": [
      0,
      1.105,
      0
    ]
  }
}


Donkey - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/donkey.json

 * At /minecraft:entity/component_groups/minecraft:donkey_wild/minecraft:rideable/: 
"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "player",
    "zombie"
  ],
  "interact_text": "action.interact.mount",
  "seats": {
    "position": [
      0,
      0.925,
      -0.2
    ]
  }
}

 * At /minecraft:entity/component_groups/minecraft:donkey_tamed/minecraft:rideable/: 
"minecraft:rideable": {
  "seat_count": 1,
  "crouching_skip_interact": true,
  "family_types": [
    "player"
  ],
  "interact_text": "action.interact.ride.horse",
  "seats": {
    "position": [
      0,
      0.925,
      -0.2
    ]
  }
}


Happy Ghast - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/happy_ghast.json

"minecraft:rideable": {
  "seat_count": 4,
  "family_types": [
    "player"
  ],
  "dismount_mode": "on_top_center",
  "on_rider_enter_event": "minecraft:on_passenger_mount",
  "on_rider_exit_event": "minecraft:on_passenger_dismount",
  "interact_text": "action.interact.ride.horse",
  "seats": [
    {
      "min_rider_count": 0,
      "max_rider_count": 4,
      "position": [
        0,
        0.95,
        0.45
      ],
      "third_person_camera_radius": 8,
      "camera_relax_distance_smoothing": 6
    },
    {
      "min_rider_count": 1,
      "max_rider_count": 4,
      "position": [
        -0.45,
        0.95,
        0
      ],
      "third_person_camera_radius": 8,
      "camera_relax_distance_smoothing": 6
    },
    {
      "min_rider_count": 2,
      "max_rider_count": 4,
      "position": [
        0,
        0.95,
        -0.45
      ],
      "third_person_camera_radius": 8,
      "camera_relax_distance_smoothing": 6
    },
    {
      "min_rider_count": 3,
      "max_rider_count": 4,
      "position": [
        0.45,
        0.95,
        0
      ],
      "third_person_camera_radius": 8,
      "camera_relax_distance_smoothing": 6
    }
  ]
}


Hoglin - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/hoglin.json

"minecraft:rideable": {
  "seat_count": 3,
  "family_types": [
    "piglin"
  ],
  "seats": [
    {
      "position": [
        0,
        0.9,
        -0.3
      ],
      "lock_rider_rotation": 0
    },
    {
      "position": [
        0,
        2.4,
        -0.3
      ],
      "lock_rider_rotation": 0
    },
    {
      "position": [
        0,
        3.9,
        -0.3
      ],
      "lock_rider_rotation": 0
    }
  ]
}


Horse - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/horse.json

 * At /minecraft:entity/component_groups/minecraft:horse_wild/minecraft:rideable/: 
"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "player",
    "zombie"
  ],
  "interact_text": "action.interact.mount",
  "seats": {
    "position": [
      0,
      1.1,
      -0.2
    ]
  }
}

 * At /minecraft:entity/component_groups/minecraft:horse_tamed/minecraft:rideable/: 
"minecraft:rideable": {
  "seat_count": 1,
  "crouching_skip_interact": true,
  "family_types": [
    "player"
  ],
  "interact_text": "action.interact.ride.horse",
  "seats": {
    "position": [
      0,
      1.1,
      -0.2
    ]
  }
}


Husk - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/husk.json

"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "zombie"
  ],
  "seats": {
    "position": [
      0,
      1.1,
      -0.35
    ],
    "lock_rider_rotation": 0
  }
}


Llama - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/llama.json

 * At /minecraft:entity/component_groups/minecraft:llama_wild/minecraft:rideable/: 
"minecraft:rideable": {
  "seat_count": 1,
  "family_types": [
    "player"
  ],
  "interact_text": "action.interact.mount",
  "seats": {
    "position": [
      0,
      1.17,
      -0.3
    ]
  }
}

 * At /minecraft:entity/component_groups/minecraft:llama_tamed/minecraft:rideable/: 
"minecraft:rideable": {
  "seat_count": 1,
  "crouching_skip_interact": true,
  "family_types": [
    "player"
  ],
  "interact_text": "action.interact.ride.horse",
  "seats": {
    "position": [
      0,
      1.17,
      -0.3
    ]
  }
}

 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Rideable (minecraft:rideable)
 * This entity can be ridden.
 */
export default interface MinecraftRideable {

  /**
   * @remarks
   * The seat that designates the driver of the entity. Entities with
   * the "minecraft:behavior.controlled_by_player" goal ignore this
   * field and give control to any player in any seat.
   */
  controlling_seat: number;

  /**
   * @remarks
   * If true, this entity can't be interacted with if the entity
   * interacting with it is crouching.
   * 
   * Sample Values:
   * Camel: true
   *
   *
   */
  crouching_skip_interact: boolean;

  /**
   * @remarks
   * Defines where riders are placed when dismounting this entity:
-
   * "default", riders are placed on a valid ground position around the
   * entity, or at the center of the entity's collision box if none is
   * found.
- "on_top_center", riders are placed at the center of
   * the top of the entity's collision box.
   * 
   * Sample Values:
   * Happy Ghast: "on_top_center"
   *
   */
  dismount_mode: string;

  /**
   * @remarks
   * List of entities that can ride this entity.
   * 
   * Sample Values:
   * Camel: ["player"]
   *
   * Cat: ["zombie"]
   *
   *
   * Donkey: ["player","zombie"]
   *
   */
  family_types: string[];

  /**
   * @remarks
   * The text to display when the player can interact with the entity
   * when playing with touch-screen controls.
   * 
   * Sample Values:
   * Camel: "action.interact.ride.horse"
   *
   * Donkey: "action.interact.mount"
   *
   *
   * Minecart: "action.interact.ride.minecart"
   *
   */
  interact_text: string;

  /**
   * @remarks
   * Event to execute on the owner entity when an entity starts riding
   * it.
   * 
   * Sample Values:
   * Happy Ghast: "minecraft:on_passenger_mount"
   *
   */
  on_rider_enter_event: string;

  /**
   * @remarks
   * Event to execute on the owner entity when an entity stops riding
   * it.
   * 
   * Sample Values:
   * Happy Ghast: "minecraft:on_passenger_dismount"
   *
   */
  on_rider_exit_event: string;

  /**
   * @remarks
   * The max width a mob can have to be a rider. A value of 0
   * ignores this parameter.
   */
  passenger_max_width: number;

  /**
   * @remarks
   * This field may exist in old data but isn't used by
   * "minecraft:rideable".
   */
  priority: number;

  /**
   * @remarks
   * If true, this entity will pull in entities that are in the
   * correct "family_types" into any available seats.
   * 
   * Sample Values:
   * Camel: true
   *
   *
   */
  pull_in_entities: boolean;

  pulls_in_entities: boolean;

  /**
   * @remarks
   * If true, this entity will be picked when looked at by the 
   * rider.
   */
  rider_can_interact: boolean;

  /**
   * @remarks
   * The number of entities that can ride this entity at the same
   * time.
   * 
   * Sample Values:
   * Camel: 2
   *
   * Cat: 1
   *
   *
   * Happy Ghast: 4
   *
   */
  seat_count: number;

  /**
   * @remarks
   * The list of positions and number of riders for each position for
   * entities riding this entity.
   * 
   * Sample Values:
   * Camel: [{"min_rider_count":0,"max_rider_count":2,"position":[0,1.905,0.5]},{"min_rider_count":1,"max_rider_count":2,"position":[0,1.905,-0.5]}]
   *
   * Cat: {"position":[0,0.35,0]}
   *
   * Chicken: {"position":[0,0.4,0]}
   *
   */
  seats: MinecraftRideableSeats[];

}


export enum MinecraftRideableDismountMode {
  Default = `default`,
  OnTopCenter = `on_top_center`
}


/**
 * The list of positions and number of riders for each position for
 * entities riding this entity.
 */
export interface MinecraftRideableSeats {

  camera_relax_distance_smoothing: number;

  /**
   * @remarks
   * Angle in degrees that a rider is allowed to rotate while riding
   * this entity. Omit this property for no limit.
   */
  lock_rider_rotation: number;

  /**
   * @remarks
   * Defines the maximum number of riders that can be riding this
   * entity for this seat to be valid.
   */
  max_rider_count: number;

  /**
   * @remarks
   * Defines the minimum number of riders that need to be riding this
   * entity before this seat can be used.
   */
  min_rider_count: number;

  /**
   * @remarks
   * Position of this seat relative to this entity's position.
   */
  position: number[];

  /**
   * @remarks
   * Offset to rotate riders by.
   */
  rotate_rider_by: string;

  third_person_camera_radius: number;

}