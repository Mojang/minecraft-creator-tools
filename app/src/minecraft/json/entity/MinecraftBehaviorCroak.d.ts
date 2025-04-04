// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Entity Documentation - minecraft:behavior.croak
 * 
 * minecraft:behavior.croak Samples

Frog - https://github.com/Mojang/bedrock-samples/tree/preview/behavior_pack/entities/frog.json

"minecraft:behavior.croak": {
  "priority": 9,
  "interval": [
    10,
    20
  ],
  "duration": 4.5,
  "filters": {
    "all_of": [
      {
        "test": "in_water",
        "value": false
      },
      {
        "test": "in_lava",
        "value": false
      }
    ]
  }
}

 */

import * as jsoncommon from './../../jsoncommon';

/**
 * Croak Behavior (minecraft:behavior.croak)
 * Allows the entity to croak at a random time interval with
 * configurable conditions.
 */
export default interface MinecraftBehaviorCroak {

  /**
   * @remarks
   * Random range in seconds after which the croaking stops. Can also
   * be a constant.
   * 
   * Sample Values:
   * Frog: 4.5
   *
   */
  duration: number[];

  /**
   * @remarks
   * Conditions for the behavior to start and keep running. The
   * interval between runs only starts after passing the filters.
   * 
   * Sample Values:
   * Frog: {"all_of":[{"test":"in_water","value":false},{"test":"in_lava","value":false}]}
   *
   */
  filters: jsoncommon.MinecraftFilter;

  /**
   * @remarks
   * Random range in seconds between runs of this behavior. Can also
   * be a constant.
   * 
   * Sample Values:
   * Frog: [10,20]
   *
   */
  interval: number[];

  /**
   * @remarks
   * As priority approaches 0, the priority is increased. The higher the
   * priority, the sooner this behavior will be executed as a 
   * goal.
   * 
   * Sample Values:
   * Frog: 9
   *
   */
  priority: number;

}